export type Profile = {
  name: string;
  industry: string;
  audience: string;
  description: string;
  voice: string;
};
export type Post = {
  id: string;
  prompt: string;
  caption: string;
  hashtags: string;
  status: "draft" | "approved" | "scheduled";
  date: string;
  createdAt: string;
  variant: number;
};
export type Workspace = { profile: Profile; posts: Post[] };
