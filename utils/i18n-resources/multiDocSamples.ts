import type { Locale } from '../i18n';

export type MultiDocSample = { name: string; text: string };

export type MultiDocSamples = {
  rename: MultiDocSample[];
  report: MultiDocSample[];
  missing: { roster: string; files: MultiDocSample[] };
  deepResearch: {
    paper: MultiDocSample[];
    theory: MultiDocSample[];
    code: MultiDocSample[];
    fallback: MultiDocSample[];
  };
  renamePatternSample: string;
};

export const MULTI_DOC_SAMPLES: Record<Locale, MultiDocSamples> = {
  zh: {
    rename: [
      {
        name: '李四_2.docx',
        text: '【实验报告】\n\n实验人：李四\n日期：2026年3月15日\n实验名称：物理光学干涉实验\n\n备注：这是本学期的第三次作业，请查收。'
      },
      {
        name: 'draft_2025_wangwu.docx',
        text: '【期末提交】\n汇报人：王五\n时间：2025/12/20\n作业批次：第八次作业\n作业主题：前端架构设计与Vue3迁移实践\n\n正文：...'
      },
      {
        name: '新建文本文档 (3).docx',
        text: '课程：数据结构\n姓名：张三\n提交时间：2026-01-01\n内容：第一次作业 - 二叉树遍历算法\n\n代码如下...'
      },
      {
        name: 'final_v2_resubmit.docx',
        text: '姓名：赵六\nDate: 2025.11.11\nSubject: 数据库系统原理\nBatch: 第五次作业\n\nSQL优化实验报告...'
      },
      {
        name: '20240909_unknown.docx',
        text: '学生：陈七\n提交日期：2024年9月9日\n作业：第二次作业\n题目：操作系统进程调度\n\n...'
      }
    ],
    report: [
      {
        name: '周报_萧炎.docx',
        text: '姓名：萧炎\n部门：强化学习组\n本周工作总结：\n1. 深入学习了强化学习算法基础。\n2. 重点研究了 PPO 算法的超参数调优。\n\n下周计划：\n- 在仿真环境中测试新模型。'
      },
      {
        name: '周报_林动.docx',
        text: '汇报人：林动\n岗位：CV算法工程师\n\n本周进度：\n- 专注于计算机视觉（CV）领域的经典算法复习。\n- 完成了 YOLOv8 的部署测试。\n\n遇到的问题：\n- 显存占用过高，需优化。'
      },
      {
        name: '周报_牧尘.docx',
        text: '姓名：牧尘\n组别：NLP组\n\n本周产出：\n1. 完成了 BERT 模型的微调实验。\n2. 阅读了 3 篇关于 RAG (检索增强生成) 的最新论文。\n\n下周重点：\n- 搭建本地知识库问答系统。'
      },
      {
        name: '周报_罗峰.docx',
        text: '汇报人：罗峰\n部门：大模型训练\n\n工作内容：\n- 监控 7B 模型预训练进度，Loss 收敛正常。\n- 清洗了 100GB 的高质量代码数据集。\n\n风险：\n- 算力资源紧张，需申请更多 GPU。'
      }
    ],
    missing: {
      roster: '孙悟空\n猪八戒\n沙悟净\n唐三藏\n白龙马',
      files: [
        { name: '作业_孙悟空.docx', text: '这是孙悟空的作业。' },
        { name: '八戒的检讨书.docx', text: '检讨人：猪八戒\n内容：我错了...' },
        { name: '卷帘大将_报告.docx', text: '姓名：沙悟净\n职务：卷帘大将\n汇报...' },
        { name: 'UNKNOWN_FILE.docx', text: '没有写名字的神秘文件...' }
      ]
    },
    deepResearch: {
      paper: [
        {
          name: 'Paper_Attention_Is_All_You_Need.txt',
          text: 'Abstract\nThe dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely...'
        },
        {
          name: 'Notes_Transformer_Arch.txt',
          text: 'Self-Attention Mechanism:\nQueries, Keys, Values.\nScaled Dot-Product Attention = softmax(QK^T / sqrt(d_k))V.\nMulti-Head Attention allows the model to jointly attend to information from different representation subspaces.'
        }
      ],
      theory: [
        {
          name: 'Quantum_Mechanics_Intro.txt',
          text: 'The Schrödinger equation is a linear partial differential equation that governs the wave function of a quantum-mechanical system.\n\nConcept 1: Wave-Particle Duality\nEvery particle or quantum entity may be described as either a particle or a wave.'
        },
        {
          name: 'Relativity_Notes.docx',
          text: 'Special relativity is a theory of the structure of spacetime. It was introduced in Einstein\'s 1905 paper \'On the Electrodynamics of Moving Bodies\'.'
        }
      ],
      code: [
        {
          name: 'attention.py',
          text: 'import torch\nimport torch.nn as nn\nimport torch.nn.functional as F\n\nclass MultiHeadAttention(nn.Module):\n    def __init__(self, d_model, num_heads):\n        super().__init__()\n        assert d_model % num_heads == 0\n        self.d_model = d_model\n        self.num_heads = num_heads\n        self.d_k = d_model // num_heads\n        \n        self.W_q = nn.Linear(d_model, d_model)\n        self.W_k = nn.Linear(d_model, d_model)\n        self.W_v = nn.Linear(d_model, d_model)\n        self.W_o = nn.Linear(d_model, d_model)\n    \n    def scaled_dot_product_attention(self, Q, K, V, mask=None):\n        attn_scores = torch.matmul(Q, K.transpose(-2, -1)) / torch.sqrt(torch.tensor(self.d_k, dtype=torch.float32))\n        if mask is not None:\n            attn_scores = attn_scores.masked_fill(mask == 0, -1e9)\n        attn_probs = F.softmax(attn_scores, dim=-1)\n        output = torch.matmul(attn_probs, V)\n        return output\n    \n    def forward(self, x, mask=None):\n        batch_size = x.size(0)\n        Q = self.W_q(x).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)\n        K = self.W_k(x).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)\n        V = self.W_v(x).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)\n        \n        attn_output = self.scaled_dot_product_attention(Q, K, V, mask)\n        attn_output = attn_output.transpose(1, 2).contiguous().view(batch_size, -1, self.d_model)\n        return self.W_o(attn_output)'
        },
        {
          name: 'transformer.py',
          text: 'import torch\nimport torch.nn as nn\n\nclass FeedForward(nn.Module):\n    def __init__(self, d_model, d_ff, dropout=0.1):\n        super().__init__()\n        self.linear1 = nn.Linear(d_model, d_ff)\n        self.dropout = nn.Dropout(dropout)\n        self.linear2 = nn.Linear(d_ff, d_model)\n    \n    def forward(self, x):\n        return self.linear2(self.dropout(F.relu(self.linear1(x))))\n\nclass TransformerBlock(nn.Module):\n    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):\n        super().__init__()\n        self.attention = MultiHeadAttention(d_model, num_heads)\n        self.norm1 = nn.LayerNorm(d_model)\n        self.norm2 = nn.LayerNorm(d_model)\n        self.feed_forward = FeedForward(d_model, d_ff, dropout)\n        self.dropout = nn.Dropout(dropout)\n    \n    def forward(self, x, mask=None):\n        attn_output = self.attention(x, mask)\n        x = self.norm1(x + self.dropout(attn_output))\n        ff_output = self.feed_forward(x)\n        x = self.norm2(x + self.dropout(ff_output))\n        return x\n\nclass Transformer(nn.Module):\n    def __init__(self, vocab_size, d_model=512, num_heads=8, \n                 num_layers=6, d_ff=2048, max_seq_len=512):\n        super().__init__()\n        self.token_embedding = nn.Embedding(vocab_size, d_model)\n        self.pos_embedding = nn.Embedding(max_seq_len, d_model)\n        self.layers = nn.ModuleList([\n            TransformerBlock(d_model, num_heads, d_ff) \n            for _ in range(num_layers)\n        ])\n        self.dropout = nn.Dropout(0.1)\n    \n    def forward(self, x, mask=None):\n        seq_len = x.size(1)\n        positions = torch.arange(0, seq_len, dtype=torch.long, device=x.device)\n        x = self.token_embedding(x) + self.pos_embedding(positions)\n        x = self.dropout(x)\n        for layer in self.layers:\n            x = layer(x, mask)\n        return x'
        }
      ],
      fallback: [
        { name: 'Research_Material_1.txt', text: 'This is a sample document for research analysis.' },
        { name: 'Research_Material_2.txt', text: 'Additional context and data points for the topic.' }
      ]
    },
    renamePatternSample: '20260101_张三_第一次作业_作业内容.docx'
  },
  en: {
    rename: [
      {
        name: 'Draft_2026_Alice.docx',
        text: 'Course: Data Structures\nName: Alice\nSubmit Date: 2026-01-01\nContent: Assignment 1 - Binary Tree Traversal\n\nCode below...'
      },
      {
        name: 'Final_Submission_Bob.docx',
        text: 'Report: Final Project\nAuthor: Bob\nDate: 2025-12-20\nTopic: Frontend Architecture Migration to Vue3\n\nBody: ...'
      },
      {
        name: 'Resubmission_Carol.docx',
        text: 'Name: Carol\nSubject: Database Systems\nBatch: Assignment 5\n\nSQL Optimization Report...'
      }
    ],
    report: [
      {
        name: 'Weekly_Alice.docx',
        text: 'Name: Alice\nTeam: RL\nThis week:\n1. Studied RL fundamentals.\n2. Tuned PPO hyperparameters.\n\nNext week:\n- Run simulations with the new model.'
      },
      {
        name: 'Weekly_Bob.docx',
        text: 'Reporter: Bob\nRole: CV Engineer\n\nProgress:\n- Reviewed classic CV algorithms.\n- Deployed YOLOv8.\n\nIssues:\n- GPU memory usage is high.'
      },
      {
        name: 'Weekly_Carol.docx',
        text: 'Name: Carol\nTeam: NLP\n\nOutputs:\n1. Finished BERT fine-tuning.\n2. Read 3 recent papers on RAG.\n\nNext focus:\n- Build a local knowledge base QA system.'
      }
    ],
    missing: {
      roster: 'Alice\nBob\nCarol\nDave\nEve',
      files: [
        { name: 'Homework_Alice.docx', text: 'This is Alice\'s homework.' },
        { name: 'Bob_Review.docx', text: 'Author: Bob\nContent: My reflections...' },
        { name: 'Carol_Report.docx', text: 'Name: Carol\nRole: Researcher\nReport...' },
        { name: 'UNKNOWN_FILE.docx', text: 'A mysterious file without a name...' }
      ]
    },
    deepResearch: {
      paper: [
        {
          name: 'Paper_Attention_Is_All_You_Need.txt',
          text: 'Abstract\nThe dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely...'
        },
        {
          name: 'Notes_Transformer_Arch.txt',
          text: 'Self-Attention Mechanism:\nQueries, Keys, Values.\nScaled Dot-Product Attention = softmax(QK^T / sqrt(d_k))V.\nMulti-Head Attention allows the model to jointly attend to information from different representation subspaces.'
        }
      ],
      theory: [
        {
          name: 'Quantum_Mechanics_Intro.txt',
          text: 'The Schrödinger equation is a linear partial differential equation that governs the wave function of a quantum-mechanical system.\n\nConcept 1: Wave-Particle Duality\nEvery particle or quantum entity may be described as either a particle or a wave.'
        },
        {
          name: 'Relativity_Notes.docx',
          text: 'Special relativity is a theory of the structure of spacetime. It was introduced in Einstein\'s 1905 paper \'On the Electrodynamics of Moving Bodies\'.'
        }
      ],
      code: [
        {
          name: 'attention.py',
          text: 'import torch\nimport torch.nn as nn\nimport torch.nn.functional as F\n\nclass MultiHeadAttention(nn.Module):\n    def __init__(self, d_model, num_heads):\n        super().__init__()\n        assert d_model % num_heads == 0\n        self.d_model = d_model\n        self.num_heads = num_heads\n        self.d_k = d_model // num_heads\n        \n        self.W_q = nn.Linear(d_model, d_model)\n        self.W_k = nn.Linear(d_model, d_model)\n        self.W_v = nn.Linear(d_model, d_model)\n        self.W_o = nn.Linear(d_model, d_model)\n    \n    def scaled_dot_product_attention(self, Q, K, V, mask=None):\n        attn_scores = torch.matmul(Q, K.transpose(-2, -1)) / torch.sqrt(torch.tensor(self.d_k, dtype=torch.float32))\n        if mask is not None:\n            attn_scores = attn_scores.masked_fill(mask == 0, -1e9)\n        attn_probs = F.softmax(attn_scores, dim=-1)\n        output = torch.matmul(attn_probs, V)\n        return output\n    \n    def forward(self, x, mask=None):\n        batch_size = x.size(0)\n        Q = self.W_q(x).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)\n        K = self.W_k(x).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)\n        V = self.W_v(x).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)\n        \n        attn_output = self.scaled_dot_product_attention(Q, K, V, mask)\n        attn_output = attn_output.transpose(1, 2).contiguous().view(batch_size, -1, self.d_model)\n        return self.W_o(attn_output)'
        }
      ],
      fallback: [
        { name: 'Research_Material_1.txt', text: 'This is a sample document for research analysis.' },
        { name: 'Research_Material_2.txt', text: 'Additional context and data points for the topic.' }
      ]
    },
    renamePatternSample: '20260101_Alice_Assignment1_Topic.docx'
  }
};
