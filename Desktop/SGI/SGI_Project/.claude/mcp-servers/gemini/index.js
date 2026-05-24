import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("❌ GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

const server = new Server(
  { name: "mcp-gemini", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── Tool definitions ────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "gemini_generate",
      description:
        "Generate text with Google Gemini 2.0 Flash. Use for: content generation, translation (AR/EN/FR), summarization, analysis, code generation.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "The prompt to send to Gemini",
          },
          model: {
            type: "string",
            description: "Gemini model to use",
            enum: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3-flash-preview"],
            default: "gemini-2.5-flash",
          },
          temperature: {
            type: "number",
            description: "Creativity level (0.0 = deterministic, 1.0 = creative)",
            minimum: 0,
            maximum: 1,
            default: 0.7,
          },
        },
        required: ["prompt"],
      },
    },
    {
      name: "gemini_translate",
      description:
        "Translate text between Arabic, English, and French. Optimized for UAE real estate terminology.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to translate" },
          from: {
            type: "string",
            enum: ["ar", "en", "fr", "auto"],
            description: "Source language (auto for auto-detect)",
            default: "auto",
          },
          to: {
            type: "string",
            enum: ["ar", "en", "fr"],
            description: "Target language",
          },
          context: {
            type: "string",
            description: "Context for better translation (e.g. 'real estate contract', 'CRM message')",
          },
        },
        required: ["text", "to"],
      },
    },
    {
      name: "gemini_analyze_property",
      description:
        "Analyze a real estate property description and extract structured data: type, features, price range estimate, Golden Visa eligibility.",
      inputSchema: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "Property description in any language",
          },
          language: {
            type: "string",
            enum: ["ar", "en", "fr"],
            default: "en",
            description: "Output language for the analysis",
          },
        },
        required: ["description"],
      },
    },
    {
      name: "gemini_score_lead",
      description:
        "Analyze a CRM lead and suggest a score (0-100) with reasoning, based on SGI scoring rules.",
      inputSchema: {
        type: "object",
        properties: {
          lead: {
            type: "object",
            description: "Lead data",
            properties: {
              budget_aed: { type: "number" },
              nationality: { type: "string" },
              property_type: { type: "string" },
              response_rate: { type: "number", description: "0 to 1" },
              contact_channels: { type: "number", description: "Number of contact channels" },
              days_since_contact: { type: "number" },
            },
          },
        },
        required: ["lead"],
      },
    },
    {
      name: "gemini_generate_contract_summary",
      description:
        "Generate a professional summary of a real estate contract in AR, EN, or FR.",
      inputSchema: {
        type: "object",
        properties: {
          contract_data: {
            type: "object",
            description: "Contract fields (parties, property, price, dates, clauses)",
          },
          language: {
            type: "string",
            enum: ["ar", "en", "fr"],
            default: "ar",
          },
        },
        required: ["contract_data"],
      },
    },
    {
      name: "gemini_whatsapp_message",
      description:
        "Generate a professional WhatsApp message for CRM follow-up in the correct language and tone for UAE market.",
      inputSchema: {
        type: "object",
        properties: {
          lead_name: { type: "string" },
          follow_up_type: {
            type: "string",
            enum: ["initial", "day1_call", "day2_whatsapp", "day4_email", "day7_final"],
          },
          property_interest: { type: "string", description: "Property the lead is interested in" },
          language: { type: "string", enum: ["ar", "en", "fr"], default: "ar" },
          agent_name: { type: "string" },
        },
        required: ["lead_name", "follow_up_type", "language"],
      },
    },
  ],
}));

// ── Tool handlers ───────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "gemini_generate": {
        const model = genAI.getGenerativeModel({
          model: args.model ?? "gemini-2.5-flash",
          generationConfig: { temperature: args.temperature ?? 0.7 },
        });
        const result = await model.generateContent(args.prompt);
        return { content: [{ type: "text", text: result.response.text() }] };
      }

      case "gemini_translate": {
        const langNames = { ar: "Arabic", en: "English", fr: "French", auto: "auto-detect" };
        const from = args.from ?? "auto";
        const contextStr = args.context ? `\nContext: ${args.context}` : "";
        const prompt = `You are a professional translator specialized in UAE real estate and business terminology.${contextStr}

Translate the following text from ${langNames[from]} to ${langNames[args.to]}.
Return ONLY the translated text, nothing else.

Text to translate:
${args.text}`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        return { content: [{ type: "text", text: result.response.text().trim() }] };
      }

      case "gemini_analyze_property": {
        const prompt = `You are an expert UAE real estate analyst. Analyze the following property description and return a JSON object with these fields:
- type: string (apartment/villa/townhouse/commercial/land/penthouse)
- bedrooms: number or null
- bathrooms: number or null
- area_sqft: number or null
- location: string
- features: string[]
- estimated_price_aed: { min: number, max: number } or null
- golden_visa_eligible: boolean (true if price >= 2,000,000 AED)
- highlights: string[] (top 3 selling points, in ${args.language ?? "en"})

Return ONLY valid JSON, no markdown, no explanation.

Property description:
${args.description}`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, "").trim();
        return { content: [{ type: "text", text }] };
      }

      case "gemini_score_lead": {
        const { lead } = args;
        const prompt = `You are a UAE real estate CRM expert. Score this lead from 0 to 100 using these SGI rules:
- Budget >= 2,000,000 AED (Golden Visa threshold): +25 pts
- Budget >= 500,000 AED: +15 pts
- Golden Visa eligible nationality: +20 pts
- Property type specified: +15 pts
- Response rate × 20: up to +20 pts
- 2+ contact channels: +10 pts
- Contact within 7 days: +10 pts

Lead data: ${JSON.stringify(lead, null, 2)}

Return JSON: { "score": number, "breakdown": { rule: points }, "recommendation": string, "golden_visa_eligible": boolean }
Return ONLY valid JSON.`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, "").trim();
        return { content: [{ type: "text", text }] };
      }

      case "gemini_generate_contract_summary": {
        const langInstructions = {
          ar: "Write in formal Arabic (فصحى). Use right-to-left formatting.",
          en: "Write in formal British English.",
          fr: "Écrivez en français formel et juridique.",
        };
        const lang = args.language ?? "ar";
        const prompt = `You are a UAE real estate legal expert. Generate a professional contract summary.
${langInstructions[lang]}

Contract data: ${JSON.stringify(args.contract_data, null, 2)}

Generate a structured summary with: parties, property details, financial terms, key dates, and important clauses.`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        const result = await model.generateContent(prompt);
        return { content: [{ type: "text", text: result.response.text() }] };
      }

      case "gemini_whatsapp_message": {
        const templates = {
          initial: "First contact message, warm and professional",
          day1_call: "Follow-up after a phone call attempt (no answer)",
          day2_whatsapp: "Second follow-up via WhatsApp",
          day4_email: "Third follow-up reference (email was sent)",
          day7_final: "Final follow-up message, last attempt before closing",
        };
        const langNames = { ar: "Arabic", en: "English", fr: "French" };
        const prompt = `You are a UAE real estate sales expert. Write a WhatsApp message for:
- Lead name: ${args.lead_name}
- Follow-up type: ${templates[args.follow_up_type]}
- Property interest: ${args.property_interest ?? "luxury properties in Dubai"}
- Agent name: ${args.agent_name ?? "our team"}
- Language: ${langNames[args.language]}
- Market: UAE (Dubai/Abu Dhabi)
- Tone: Professional, warm, not pushy

Write ONLY the WhatsApp message text. Keep it concise (max 3 paragraphs). Include a clear call-to-action.`;

        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          generationConfig: { temperature: 0.8 },
        });
        const result = await model.generateContent(prompt);
        return { content: [{ type: "text", text: result.response.text().trim() }] };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Gemini API error: ${error.message}` }],
      isError: true,
    };
  }
});

// ── Start server ────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("✓ MCP Gemini server running");
