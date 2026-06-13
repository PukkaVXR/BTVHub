import { StreamEventTypeSchema, z } from "@btv/shared";
import type { FastifyReply } from "fastify";

export function parseBody<Schema extends z.ZodTypeAny>(
  reply: FastifyReply,
  schema: Schema,
  body: unknown,
): z.output<Schema> | undefined {
  const parsed = schema.safeParse(body ?? {});
  if (parsed.success) return parsed.data;
  void reply.status(400).send({
    error: parsed.error.issues[0]?.message ?? "Invalid request body",
    issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  });
  return undefined;
}

export const UnknownRecordBodySchema = z.record(z.unknown());

export const UploadAssetBodySchema = z.object({
  name: z.string().min(1),
  data: z.string().min(1),
});

export const GiphyImportBodySchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  originalUrl: z.string().url(),
  sourceUrl: z.string().optional(),
  username: z.string().optional(),
  type: z.enum(["gif", "sticker"]).optional(),
});

export const IntegrationCredentialsBodySchema = z.object({
  clientId: z.string().trim().min(1),
  clientSecret: z.string().optional(),
});

export const ObsIntegrationBodySchema = z.object({
  host: z.string().trim().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  password: z.string().optional(),
});

export const GoalUpdateBodySchema = z.object({
  current: z.coerce.number().optional(),
  target: z.coerce.number().optional(),
  label: z.string().trim().min(1).optional(),
});

export const AmountBodySchema = z.object({ amount: z.coerce.number() });
export const PriorityBodySchema = z.object({ priority: z.coerce.number().default(0) });
export const SessionStartBodySchema = z.object({ title: z.string().trim().optional() });
export const SourceNamesBodySchema = z.object({ sourceNames: z.array(z.string().min(1)).optional() });
export const OAuthHostBodySchema = z.object({ host: z.string().trim().min(1) });
export const GiphyKeyBodySchema = z.object({ apiKey: z.string().optional() });

export const OptionalTextBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});

export const StreamEventTestBodySchema = z.object({
  type: StreamEventTypeSchema.optional(),
  eventType: StreamEventTypeSchema.optional(),
  user: z.object({
    id: z.string().optional(),
    login: z.string().optional(),
    displayName: z.string().optional(),
  }).optional(),
  message: z.string().optional(),
  amount: z.coerce.number().optional(),
  payload: z.record(z.unknown()).optional(),
  testPayload: z.record(z.unknown()).optional(),
  variationId: z.string().optional(),
});

export const CoreEventDispatchBodySchema = z.object({
  type: z.string().optional(),
  payload: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const GiveawayOpenBodySchema = z.object({
  name: z.unknown().optional(),
  keyword: z.unknown().optional(),
});

export const ViewerIdentityBodySchema = z.object({
  userId: z.unknown().optional(),
  login: z.unknown().optional(),
  displayName: z.unknown().optional(),
  note: z.unknown().optional(),
});

export const LoyaltyUpdateBodySchema = z.object({
  points: z.unknown().optional(),
  delta: z.unknown().optional(),
  mode: z.unknown().optional(),
});

export const CommandApprovalBodySchema = z.object({
  command: z.string().optional(),
  args: z.array(z.unknown()).optional(),
  cwd: z.string().optional(),
  timeoutMs: z.number().optional(),
  label: z.string().optional(),
});

export const ImportPackBodySchema = z.object({ pack: z.unknown().optional() });

export const BossFightUpdateBodySchema = z.object({
  name: z.string().optional(),
  subtitle: z.string().optional(),
  maxHp: z.coerce.number().optional(),
  currentHp: z.coerce.number().optional(),
  shield: z.coerce.number().optional(),
  phase: z.coerce.number().optional(),
  visible: z.boolean().optional(),
  enraged: z.boolean().optional(),
  color: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const ChatChaosUpdateBodySchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  level: z.coerce.number().optional(),
  threshold: z.coerce.number().optional(),
  decayPerMinute: z.coerce.number().optional(),
  visible: z.boolean().optional(),
  color: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const TournamentScoreboardUpdateBodySchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  bestOf: z.coerce.number().optional(),
  visible: z.boolean().optional(),
  teams: z.array(z.object({
    id: z.string(),
    name: z.string(),
    score: z.coerce.number(),
    color: z.string(),
  })).optional(),
  updatedAt: z.string().optional(),
});

export const PredictionUpdateBodySchema = z.object({
  title: z.string().optional(),
  prompt: z.string().optional(),
  status: z.enum(["draft", "open", "locked", "revealed"]).optional(),
  visible: z.boolean().optional(),
  options: z.array(z.object({
    id: z.string(),
    label: z.string(),
    votes: z.coerce.number(),
    color: z.string(),
    isWinner: z.boolean(),
  })).optional(),
  updatedAt: z.string().optional(),
});
