"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Ic, Svg } from "./icons";
import {
  type PublicListing,
  formatAed,
  formatSqft,
  formatNumber,
} from "@/lib/realestate";

export interface BookingLabels {
  title: string;
  subtitle: string;
  name: string;
  namePlaceholder: string;
  phone: string;
  date: string;
  slot: string;
  confirm: string;
  sending: string;
  booked: string;
  bookedSub: string;
  property: string;
  when: string;
  close: string;
  bedrooms: string;
  bathrooms: string;
  perYear: string;
  reference: string;
  errorValidation: string;
  errorNetwork: string;
}

interface BookingCtx {
  open: (listing: PublicListing) => void;
}

const Ctx = createContext<BookingCtx>({ open: () => {} });

export function useBooking(): BookingCtx {
  return useContext(Ctx);
}

const SLOTS_EN = [
  "10:00 AM",
  "11:30 AM",
  "1:00 PM",
  "2:30 PM",
  "4:00 PM",
  "5:30 PM",
];
const SLOTS_AR = ["10:00 ص", "11:30 ص", "1:00 م", "2:30 م", "4:00 م", "5:30 م"];

/**
 * Provider + modal de réservation de visite. Les composants enfants ouvrent la
 * modal via `useBooking().open(listing)`. À la confirmation, POST vers
 * `/api/public/lead` (relai public, sans cookie) avec un message contenant le
 * créneau choisi. RTL : CSS logique uniquement (Loi 3).
 */
export function BookingProvider({
  locale,
  labels,
  children,
}: {
  locale: string;
  labels: BookingLabels;
  children: ReactNode;
}) {
  const [listing, setListing] = useState<PublicListing | null>(null);
  const open = useCallback((l: PublicListing) => setListing(l), []);
  const close = useCallback(() => setListing(null), []);

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {listing ? (
        <Modal
          listing={listing}
          locale={locale}
          labels={labels}
          onClose={close}
        />
      ) : null}
    </Ctx.Provider>
  );
}

function Modal({
  listing,
  locale,
  labels,
  onClose,
}: {
  listing: PublicListing;
  locale: string;
  labels: BookingLabels;
  onClose: () => void;
}) {
  const isAr = locale === "ar";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateIdx, setDateIdx] = useState<number | null>(null);
  const [slotIdx, setSlotIdx] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 10 prochains jours, libellés localisés (calcul client → pas d'hydratation SSR).
  const dates = useMemo(() => {
    const fmtDow = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const fmtMon = new Intl.DateTimeFormat(locale, { month: "short" });
    const base = new Date();
    base.setDate(base.getDate() + 1);
    return Array.from({ length: 10 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return {
        dow: fmtDow.format(d),
        num: new Intl.NumberFormat("en-AE").format(d.getDate()),
        mon: fmtMon.format(d),
        iso: d.toISOString().slice(0, 10),
      };
    });
  }, [locale]);

  const slots = isAr ? SLOTS_AR : SLOTS_EN;
  const ready =
    dateIdx !== null && slotIdx !== null && name.trim() && phone.trim();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const price = formatAed(listing.price);
  const isRent = listing.deal === "rent";
  const sqft = formatSqft(listing.area_sqm);
  const loc =
    [listing.district, listing.city, listing.emirate]
      .filter(Boolean)
      .join(" · ") || "—";

  async function confirm() {
    if (!ready || dateIdx === null || slotIdx === null) return;
    setSending(true);
    setErr(null);
    const d = dates[dateIdx];
    const message = `[${labels.title}] ${d.dow} ${d.num} ${d.mon} · ${slots[slotIdx]} — ${listing.title ?? listing.slug ?? ""}`;
    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          listing_slug: listing.slug,
          message,
        }),
      });
      if (!res.ok) {
        setErr(
          res.status === 400 ? labels.errorValidation : labels.errorNetwork,
        );
        setSending(false);
        return;
      }
      setDone(true);
    } catch {
      setErr(labels.errorNetwork);
    } finally {
      setSending(false);
    }
  }

  const summaryWhen =
    dateIdx !== null && slotIdx !== null
      ? `${dates[dateIdx].dow} ${dates[dateIdx].num} ${dates[dateIdx].mon} · ${slots[slotIdx]}`
      : "";

  return (
    <div className="z-modal-bg" onClick={onClose}>
      <div
        className="z-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <aside className="z-modal-aside">
          <div>
            <div className="z-mimg">
              {listing.photos?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.photos[0]} alt={listing.title ?? ""} />
              ) : null}
            </div>
            <h4>{listing.title ?? "—"}</h4>
            <div className="z-mloc">
              <Svg d={Ic.pin} w={15} /> {loc}
            </div>
            {price ? (
              <div className="z-mprice">
                {price}
                {isRent ? (
                  <span style={{ fontSize: 14 }}> {labels.perYear}</span>
                ) : null}
              </div>
            ) : null}
          </div>
          <ul>
            {listing.bedrooms != null ? (
              <li>
                <Svg d={Ic.bed} w={16} /> {formatNumber(listing.bedrooms)}{" "}
                {labels.bedrooms}
              </li>
            ) : null}
            {listing.bathrooms != null ? (
              <li>
                <Svg d={Ic.bath} w={16} /> {formatNumber(listing.bathrooms)}{" "}
                {labels.bathrooms}
              </li>
            ) : null}
            {sqft ? (
              <li>
                <Svg d={Ic.area} w={16} /> {sqft} sqft
              </li>
            ) : null}
          </ul>
        </aside>

        <div className="z-modal-main">
          {!done ? (
            <>
              <div className="z-mhead">
                <h3>{labels.title}</h3>
                <button
                  className="z-modal-close"
                  onClick={onClose}
                  aria-label={labels.close}
                >
                  <Svg d={Ic.x} w={18} />
                </button>
              </div>
              <p className="z-msub">{labels.subtitle}</p>

              <div className="z-frow">
                <div>
                  <label className="z-flabel">{labels.name}</label>
                  <input
                    className="z-finput"
                    value={name}
                    maxLength={120}
                    placeholder={labels.namePlaceholder}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="z-flabel">{labels.phone}</label>
                  <input
                    className="z-finput"
                    value={phone}
                    maxLength={40}
                    placeholder="+971 5x xxx xxxx"
                    inputMode="tel"
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <label className="z-flabel">{labels.date}</label>
              <div className="z-dategrid">
                {dates.map((d, i) => (
                  <button
                    key={d.iso}
                    type="button"
                    className={`z-datecell ${dateIdx === i ? "on" : ""}`}
                    onClick={() => setDateIdx(i)}
                  >
                    <div className="z-dow">{d.dow}</div>
                    <div className="z-dnum">{d.num}</div>
                    <div className="z-dmon">{d.mon}</div>
                  </button>
                ))}
              </div>

              <label className="z-flabel">{labels.slot}</label>
              <div className="z-slots">
                {slots.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    className={`z-slot ${slotIdx === i ? "on" : ""}`}
                    onClick={() => setSlotIdx(i)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {err ? (
                <p
                  style={{ color: "#d6453d", fontSize: 13.5, marginBottom: 14 }}
                >
                  {err}
                </p>
              ) : null}

              <button
                type="button"
                className="z-btn z-btn-gold"
                disabled={!ready || sending}
                style={{
                  opacity: ready && !sending ? 1 : 0.5,
                  cursor: ready && !sending ? "pointer" : "not-allowed",
                }}
                onClick={confirm}
              >
                <Svg d={Ic.check} w={17} />{" "}
                {sending ? labels.sending : labels.confirm}
              </button>
            </>
          ) : (
            <div className="z-booked">
              <div className="z-ok">
                <Svg d={Ic.check} w={38} />
              </div>
              <h3>{labels.booked}</h3>
              <p>{labels.bookedSub}</p>
              <div className="z-summ">
                <div>
                  <span>{labels.property}</span>
                  <b>{listing.title ?? "—"}</b>
                </div>
                <div>
                  <span>{labels.when}</span>
                  <b>{summaryWhen}</b>
                </div>
              </div>
              <button
                type="button"
                className="z-btn z-btn-green"
                onClick={onClose}
              >
                {labels.close}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
