import { days } from "./agenda";
import { now } from "./weather";

const [nextTime, nextTitle] = days[0].events[1];

export const todayAtAGlance = {
  text: `${now.icon} ${now.temperature}° → ☂ ${now.rainFrom} · ${nextTime} ${nextTitle}`,
  label: `${now.temperature}°, rain from ${now.rainFrom}, ${nextTitle} at ${nextTime}`,
};
