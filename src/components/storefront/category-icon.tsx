import { createElement } from "react";
import {
  Baby,
  Camera,
  Cpu,
  Droplet,
  Dumbbell,
  Flower2,
  Footprints,
  Gamepad2,
  Gem,
  Glasses,
  Headphones,
  Lamp,
  Laptop,
  Mic,
  Mouse,
  Palette,
  PlugZap,
  Printer,
  Shapes,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sofa,
  Sparkles,
  Speaker,
  Utensils,
  Watch,
  type LucideIcon,
} from "lucide-react";

/** Keyword → icon. First match wins, so specific words come before broad ones. */
const RULES: [RegExp, LucideIcon][] = [
  [/watch|wearable/, Watch],
  [/earbud|headphone|audio|sound/, Headphones],
  [/speaker/, Speaker],
  [/mic/, Mic],
  [/mouse|keyboard/, Mouse],
  [/charger|power|cable/, PlugZap],
  [/camera|drone/, Camera],
  [/printer/, Printer],
  [/laptop|computer|pc\b/, Laptop],
  [/gaming|game|console/, Gamepad2],
  [/phone|mobile|smart/, Smartphone],
  [/gadget|electronic|tech/, Cpu],
  [/skin|serum|care|bath/, Droplet],
  [/makeup|cosmetic|lip|shade/, Palette],
  [/fragrance|perfume|scent/, Flower2],
  [/beauty/, Sparkles],
  [/shoe|footwear|sandal/, Footprints],
  [/jewel|ring|necklace/, Gem],
  [/eyewear|glass|sunglass/, Glasses],
  [/fashion|cloth|apparel|wear|kurti|shirt|saree|dress/, Shirt],
  [/bag|accessor/, ShoppingBag],
  [/furniture|sofa|chair/, Sofa],
  [/kitchen|dining|mug|cook|tableware/, Utensils],
  [/home|living|decor|lamp|light/, Lamp],
  [/baby|kid|toy/, Baby],
  [/fitness|sport|gym/, Dumbbell],
];

export function categoryIcon(slugOrName: string): LucideIcon {
  const key = slugOrName.toLowerCase();
  return RULES.find(([pattern]) => pattern.test(key))?.[1] ?? Shapes;
}

export function CategoryIcon({ slug, name, className }: { slug: string; name: string; className?: string }) {
  // Icons are static module-level components picked by lookup, not created per render.
  return createElement(categoryIcon(`${slug} ${name}`), { className, strokeWidth: 1.4, "aria-hidden": true });
}
