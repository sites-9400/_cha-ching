import { channelLogo } from "../lib/channels";

/** Leading row icon: the channel's brand logo when bundled, else the tinted
 *  initial circle. Logo plate uses bg-[#fff] (not bg-white) deliberately —
 *  the dark-mode layer must not remap it, logos need a light background. */
export default function ChannelIcon(
  { channel, initial, chipClass }: { channel: string; initial: string; chipClass: string },
) {
  const logo = channelLogo(channel);
  if (logo) {
    return (
      <span className="h-9 w-9 shrink-0 rounded-full bg-[#fff] ring-1 ring-stone-200 flex items-center justify-center overflow-hidden">
        <img src={logo} alt={channel} className="h-6 w-6 object-contain" />
      </span>
    );
  }
  return (
    <span className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${chipClass}`}>
      {initial}
    </span>
  );
}
