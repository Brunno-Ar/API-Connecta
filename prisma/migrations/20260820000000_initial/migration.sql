CREATE TABLE "interactions" (
  "id" UUID NOT NULL,
  "external_event_id" VARCHAR(200),
  "contact_id" VARCHAR(200) NOT NULL,
  "bot_id" VARCHAR(200) NOT NULL,
  "raw_payload" JSONB NOT NULL,
  "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "interaction_selections" (
  "id" UUID NOT NULL,
  "interaction_id" UUID NOT NULL,
  "key" VARCHAR(100) NOT NULL,
  "value" JSONB NOT NULL,
  "value_text" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interaction_selections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "interactions_external_event_id_key" ON "interactions"("external_event_id");
CREATE INDEX "interactions_bot_id_received_at_idx" ON "interactions"("bot_id", "received_at");
CREATE INDEX "interactions_contact_id_received_at_idx" ON "interactions"("contact_id", "received_at");
CREATE INDEX "interactions_received_at_idx" ON "interactions"("received_at");
CREATE UNIQUE INDEX "interaction_selections_interaction_id_key_key" ON "interaction_selections"("interaction_id", "key");
CREATE INDEX "interaction_selections_key_value_text_idx" ON "interaction_selections"("key", "value_text");
CREATE INDEX "interaction_selections_interaction_id_idx" ON "interaction_selections"("interaction_id");
ALTER TABLE "interaction_selections" ADD CONSTRAINT "interaction_selections_interaction_id_fkey"
  FOREIGN KEY ("interaction_id") REFERENCES "interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
