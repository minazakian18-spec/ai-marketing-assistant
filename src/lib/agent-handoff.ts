// A file the user attached in an Agent composer. Previews are object URLs,
// released by the Agent provider when the conversation is reset.
export type AgentAttachment = {
  id: string;
  file: File;
  kind: "image" | "file";
  preview?: string;
};
