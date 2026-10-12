/**
 * Fills every homepage banner slot with a sample photo from prisma/fixtures/images/home
 * (development/E2E only). Goes through the real upload and save services, so images are
 * validated, stored under random keys and audited, and the owner can replace each one in
 * Admin → Homepage settings. Skips when the homepage already has any image.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../../src/lib/db/client";
import { updateHomepageSection, uploadContentImage } from "../../src/modules/content/content.service";
import { contentImageKeys, parseHomepageContent, type ContentSection } from "../../src/modules/content/schema";
import type { StaffActor } from "../../src/modules/identity/actor";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "images", "home");

interface SampleBanner {
  title: string;
  subtitle?: string;
  href: string;
  /** File in images/home; omitted for gallery text cards. */
  photo?: string;
}

const TAGLINE = "Beauty, fashion, gadgets and everyday living, all in one place.";
const cat = (title: string, slug: string, photo: string, subtitle = ""): SampleBanner => ({ title, subtitle, href: `/categories/${slug}`, photo });

const HEROES: SampleBanner[] = [
  { title: "Everything You Love, Delivered", subtitle: TAGLINE, href: "/shop", photo: "hero-shopping.jpg" },
  cat("Beauty", "beauty", "beauty.jpg", "Makeup · Skincare"),
];
const PROMOS: SampleBanner[] = [
  cat("Beauty", "beauty", "makeup-2.jpg", "Makeup · Skincare"),
  cat("Fashion", "fashion", "fashion.jpg", "Women's clothing · Men's clothing"),
  cat("Gadgets", "gadgets", "gadgets.jpg", "Audio · Wearables"),
  cat("Home & Living", "home-and-living", "home.jpg"),
];
const SLIDER: SampleBanner[] = [
  cat("Fashion", "fashion", "womens.jpg", "Women's clothing · Men's clothing"),
  cat("Gadgets", "gadgets", "audio.jpg", "Audio · Wearables"),
  cat("Home & Living", "home-and-living", "home-2.jpg"),
  cat("Beauty", "beauty", "skincare.jpg", "Makeup · Skincare"),
  cat("Men's clothing", "men-s-clothing", "mens.jpg"),
  cat("Wearables", "wearables", "wearables.jpg"),
];
const TILES: SampleBanner[] = [
  cat("Gadgets", "gadgets", "audio-2.jpg"),
  cat("Home & Living", "home-and-living", "home-3.jpg"),
  cat("Beauty", "beauty", "makeup.jpg"),
  cat("Fashion", "fashion", "mens-2.jpg"),
];
/** Slots 3 and 6 stay text cards, matching the gallery's reference layout. */
const GALLERY: SampleBanner[] = [
  cat("Beauty", "beauty", "beauty.jpg"),
  cat("Makeup", "makeup", "makeup.jpg"),
  cat("Skincare", "skincare", "skincare.jpg"),
  { title: "Fashion", subtitle: "Explore fashion picked for everyday living.", href: "/categories/fashion" },
  cat("Women's clothing", "women-s-clothing", "womens.jpg"),
  cat("Men's clothing", "men-s-clothing", "mens.jpg"),
  { title: "Gadgets", subtitle: "Explore gadgets picked for everyday living.", href: "/categories/gadgets" },
  cat("Audio", "audio", "audio.jpg"),
  cat("Wearables", "wearables", "wearables.jpg"),
  cat("Home & Living", "home-and-living", "home-2.jpg"),
];
const SPOTLIGHT: SampleBanner = { title: "Everyday Made Easy", subtitle: "Discover practical products that bring better performance, effortless convenience and modern style.", href: "/shop", photo: "hero-store.jpg" };
const FEATURE: SampleBanner = { title: "Upgrade Your Lifestyle", subtitle: "Smarter everyday essentials designed to make every moment easier, faster and more connected.", href: "/shop", photo: "store-2.jpg" };
const SPLITS = [
  { lead: "Beauty", body: "Makeup · Skincare", categorySlug: "beauty", photo: "makeup-2.jpg" },
  { lead: "Fashion", body: "Women's clothing · Men's clothing", categorySlug: "fashion", photo: "fashion.jpg" },
];

export async function seedHomepageImages(actor: StaffActor): Promise<boolean> {
  const row = await db.storefrontContent.findUnique({ where: { businessId: actor.businessId }, select: { data: true } });
  const current = parseHomepageContent(row?.data);
  if (contentImageKeys(current).length) return false;

  const keys = new Map<string, string>();
  const keyFor = async (photo: string | undefined) => {
    if (!photo) return "";
    if (!keys.has(photo)) keys.set(photo, (await uploadContentImage(actor, { name: photo, bytes: new Uint8Array(await readFile(path.join(DIR, photo))) })).key);
    return keys.get(photo)!;
  };
  const fields: Record<string, string> = {};
  const banner = async (prefix: string, b: SampleBanner) => {
    Object.assign(fields, {
      [`${prefix}.title`]: b.title,
      [`${prefix}.subtitle`]: b.subtitle ?? "",
      [`${prefix}.href`]: b.href,
      [`${prefix}.ctaLabel`]: "Shop Now",
      [`${prefix}.imageKey`]: await keyFor(b.photo),
      [`${prefix}.imageAlt`]: b.photo ? b.title : "",
    });
  };
  const list = async (prefix: string, banners: SampleBanner[]) => {
    for (const [i, b] of banners.entries()) await banner(`${prefix}.${i}`, b);
  };

  await list("heroes", HEROES);
  await list("promos", PROMOS);
  await list("slider", SLIDER);
  await list("tiles", TILES);
  await list("gallery.items", GALLERY);
  await banner("spotlight.banner", SPOTLIGHT);
  await banner("feature.banner", FEATURE);
  for (const [i, s] of SPLITS.entries()) {
    Object.assign(fields, { [`splits.${i}.lead`]: s.lead, [`splits.${i}.body`]: s.body, [`splits.${i}.categorySlug`]: s.categorySlug, [`splits.${i}.imageKey`]: await keyFor(s.photo), [`splits.${i}.imageAlt`]: s.lead });
  }

  // Sections not set here keep their current values (headings, category choices, sale copy).
  const keep: Record<string, string> = {
    "spotlight.lead": current.spotlight.lead,
    "spotlight.accent": current.spotlight.accent,
    "spotlight.body": current.spotlight.body,
    "spotlight.categorySlug": current.spotlight.categorySlug,
    "gallery.lead": current.gallery.lead,
    "gallery.accent": current.gallery.accent,
    "gallery.body": current.gallery.body,
    "feature.categorySlug": current.feature.categorySlug,
    "sale.couponCode": current.sale.couponCode,
    "sale.eyebrow": current.sale.eyebrow,
    "sale.title": current.sale.title,
    "sale.body": current.sale.body,
    "sale.tags": current.sale.tags.join("\n"),
    "sale.ctaLabel": current.sale.ctaLabel,
    "sale.href": current.sale.href,
    "sale.imageKey": await keyFor("sale.jpg"),
  };
  const get = (name: string) => fields[name] ?? keep[name] ?? "";
  for (const section of ["heroes", "promos", "slider", "spotlight", "tiles", "gallery", "feature", "sale", "splits"] satisfies ContentSection[]) {
    await updateHomepageSection(actor, section, get);
  }
  return true;
}
