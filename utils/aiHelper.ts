
import { GoogleGenAI } from "@google/genai";

export interface AIRequest {
  apiKey: string;
  model: string;
  baseUrl?: string; // If present, use OpenAI compatible fetch
  prompt: string;
  messages?: any[]; // Optional: complete message history for chat/agent mode
  systemInstruction?: string;
  image?: string; // base64 string without data URI prefix (for Gemini) or full handling
  mimeType?: string; // e.g. 'image/png' or 'image/jpeg'
  jsonSchema?: any; // For Gemini schema or OpenAI json_object mode hint
}

/**
 * Unified function to call either Google Gemini SDK or OpenAI-compatible API (e.g. Alibaba DashScope)
 */
export async function generateContent(req: AIRequest): Promise<string> {
  const mimeType = req.mimeType || 'image/png';

  // ---------------------------------------------------------
  // 1. OpenAI Compatible Mode (For Alibaba Qwen, DeepSeek, etc.)
  // ---------------------------------------------------------
  if (req.baseUrl) {
    let messages: any[] = [];
    
    // If explicit messages history is provided, use it as base
    if (req.messages && req.messages.length > 0) {
        messages = [...req.messages];
        // If there is also a prompt, add it as a user message
        if (req.prompt) {
             messages.push({ role: 'user', content: req.prompt });
        }
    } else {
        // Standard single-turn construction
    // System Prompt
    if (req.systemInstruction) {
      messages.push({ role: 'system', content: req.systemInstruction });
    }

    // User Content (Text + Image)
    const content: any[] = [{ type: 'text', text: req.prompt }];
    
    if (req.image) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${req.image}` }
      });
    }
    
    messages.push({ role: 'user', content });
    }

    const body: any = {
      model: req.model,
      messages: messages,
      stream: false 
    };

    // Handle JSON mode loosely for compatible APIs
    if (req.jsonSchema) {
       body.response_format = { type: "json_object" };
       const lastMsg = messages[messages.length - 1];
       const jsonInstruction = "\n\nPlease respond in valid JSON format.";
       if (typeof lastMsg.content === 'string') {
           lastMsg.content += jsonInstruction;
       } else if (Array.isArray(lastMsg.content)) {
           lastMsg.content[0].text += jsonInstruction;
       }
    }

    const cleanBaseUrl = req.baseUrl.replace(/\/+$/, '');
    const endpoint = cleanBaseUrl.endsWith('/chat/completions') 
        ? cleanBaseUrl 
        : `${cleanBaseUrl}/chat/completions`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${req.apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const result = data.choices?.[0]?.message?.content;
        
        if (!result) throw new Error("No content in response");
        return result;
    } catch (e: any) {
        console.error("Compatible API Error:", e);
        throw new Error(`AI Request Failed: ${e.message}`);
    }
  } 
  
  // ---------------------------------------------------------
  // 2. Google Gemini Native SDK Mode
  // ---------------------------------------------------------
  const ai = new GoogleGenAI({ apiKey: req.apiKey });
  
  const parts: any[] = [];
  if (req.image) {
    parts.push({ inlineData: { mimeType: mimeType, data: req.image } });
  }
  parts.push({ text: req.prompt });

  const config: any = {};
  if (req.systemInstruction) {
    config.systemInstruction = req.systemInstruction;
  }
  if (req.jsonSchema) {
    config.responseMimeType = "application/json";
    config.responseSchema = req.jsonSchema;
  }

  const response = await ai.models.generateContent({
    model: req.model,
    contents: { parts },
    config
  });

  return response.text || "";
}

/**
 * Stream Generator for Real-time Typewriter Effect
 */
export async function* generateContentStream(req: AIRequest): AsyncGenerator<string, void, unknown> {
    const mimeType = req.mimeType || 'image/png';
  
    // ---------------------------------------------------------
    // 1. OpenAI Compatible Streaming
    // ---------------------------------------------------------
    if (req.baseUrl) {
      let messages: any[] = [];
      
      if (req.messages && req.messages.length > 0) {
          messages = [...req.messages];
          if (req.prompt) {
               messages.push({ role: 'user', content: req.prompt });
          }
      } else {
        if (req.systemInstruction) messages.push({ role: 'system', content: req.systemInstruction });
        const content: any[] = [{ type: 'text', text: req.prompt }];
        if (req.image) {
          content.push({
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${req.image}` }
          });
        }
        messages.push({ role: 'user', content });
      }
  
      const body: any = {
        model: req.model,
        messages: messages,
        stream: true 
      };

      if (req.jsonSchema) {
        body.response_format = { type: "json_object" };
        // Ensure the last message prompts for JSON if not already handled
        const lastMsg = messages[messages.length - 1];
        const jsonInstruction = "\n\nPlease respond in valid JSON format.";
        if (typeof lastMsg.content === 'string' && !lastMsg.content.includes(jsonInstruction)) {
            lastMsg.content += jsonInstruction;
        }
      }
  
      const cleanBaseUrl = req.baseUrl.replace(/\/+$/, '');
      const endpoint = cleanBaseUrl.endsWith('/chat/completions') 
          ? cleanBaseUrl 
          : `${cleanBaseUrl}/chat/completions`;
  
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${req.apiKey}`
        },
        body: JSON.stringify(body)
      });
  
      if (!response.ok || !response.body) {
         throw new Error(`Stream Error ${response.status}`);
      }
  
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
  
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; 
  
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (trimmed.startsWith('data: ')) {
                try {
                    const json = JSON.parse(trimmed.substring(6));
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) yield delta;
                } catch (e) {
                    // ignore parse errors for partial chunks
                }
            }
        }
      }
      return;
    }
  
    // ---------------------------------------------------------
    // 2. Google Gemini Native Streaming
    // ---------------------------------------------------------
    const ai = new GoogleGenAI({ apiKey: req.apiKey });
    const parts: any[] = [];
    if (req.image) parts.push({ inlineData: { mimeType: mimeType, data: req.image } });
    parts.push({ text: req.prompt });
  
    const config: any = {};
    if (req.systemInstruction) config.systemInstruction = req.systemInstruction;
  
    const result = await ai.models.generateContentStream({
      model: req.model,
      contents: { parts },
      config
    });
  
    // Fix: Iterate over the result directly, and use .text property
    for await (const chunk of result) {
      const chunkText = chunk.text;
      if (chunkText) yield chunkText;
    }
  }
