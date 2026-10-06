import { BrandIcon } from "@/components/brand-icon";
import { capabilities, type Channel } from "@/lib/inbox/shared";

export function ChannelIcon({ channel, size = 14, label = false }: { channel: Channel; size?: number; label?: boolean }) {
  return (
    <span className="ib-channel" title={capabilities[channel].label}>
      <BrandIcon brand={channel} size={size} title={capabilities[channel].label} />
      {label && <span>{capabilities[channel].label}</span>}
    </span>
  );
}
