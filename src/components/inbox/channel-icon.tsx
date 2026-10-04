import { Instagram, Mail, MessageCircle, MessagesSquare } from "lucide-react";
import { capabilities, type Channel } from "@/lib/inbox/shared";

const ICONS = { gmail: Mail, instagram: Instagram, messenger: MessagesSquare, whatsapp: MessageCircle };

export function ChannelIcon({ channel, size = 14, label = false }: { channel: Channel; size?: number; label?: boolean }) {
  const Icon = ICONS[channel];
  return (
    <span className={"ib-channel ib-channel-" + channel} title={capabilities[channel].label}>
      <Icon size={size} aria-hidden="true" />
      {label ? <span>{capabilities[channel].label}</span> : <span className="sr-only">{capabilities[channel].label}</span>}
    </span>
  );
}
