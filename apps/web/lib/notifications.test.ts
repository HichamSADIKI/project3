import { describe, it, expect } from "vitest";

import {
  isUnread,
  unreadCount,
  prependNotif,
  markReadInList,
  markAllReadInList,
  buildWsUrl,
  formatNotifTime,
  type NotifItem,
} from "./notifications";

const mk = (id: string, status = "sent"): NotifItem => ({
  id,
  type: "test",
  title: `N${id}`,
  body: null,
  status,
  created_at: "2026-06-06T10:00:00Z",
  read_at: status === "read" ? "2026-06-06T10:01:00Z" : null,
});

describe("isUnread / unreadCount", () => {
  it("non lue tant que status != read", () => {
    expect(isUnread({ status: "sent" })).toBe(true);
    expect(isUnread({ status: "pending" })).toBe(true);
    expect(isUnread({ status: "read" })).toBe(false);
  });
  it("compte les non-lues", () => {
    expect(unreadCount([mk("1"), mk("2", "read"), mk("3")])).toBe(2);
  });
});

describe("prependNotif", () => {
  it("ajoute en tête", () => {
    const out = prependNotif([mk("1")], mk("2"));
    expect(out.map((n) => n.id)).toEqual(["2", "1"]);
  });
  it("déduplique par id", () => {
    const out = prependNotif([mk("1"), mk("2")], mk("2"));
    expect(out.map((n) => n.id)).toEqual(["2", "1"]);
  });
  it("borne la taille", () => {
    const many = Array.from({ length: 30 }, (_, i) => mk(`x${i}`));
    expect(prependNotif(many, mk("new"), 30)).toHaveLength(30);
  });
});

describe("markReadInList / markAllReadInList", () => {
  it("marque une notif lue", () => {
    const out = markReadInList([mk("1"), mk("2")], "1", "2026-06-06T11:00:00Z");
    expect(out[0].status).toBe("read");
    expect(out[0].read_at).toBe("2026-06-06T11:00:00Z");
    expect(out[1].status).toBe("sent");
  });
  it("marque tout lu", () => {
    const out = markAllReadInList([mk("1"), mk("2", "read")], "2026-06-06T11:00:00Z");
    expect(unreadCount(out)).toBe(0);
  });
});

describe("buildWsUrl", () => {
  it("http → ws", () => {
    expect(buildWsUrl("http://localhost:5001", "TICK")).toBe(
      "ws://localhost:5001/api/v1/notifications/ws?token=TICK",
    );
  });
  it("https → wss + encode le ticket", () => {
    expect(buildWsUrl("https://app.sgi.ae", "a/b+c")).toBe(
      "wss://app.sgi.ae/api/v1/notifications/ws?token=a%2Fb%2Bc",
    );
  });
});

describe("formatNotifTime", () => {
  const now = new Date("2026-06-06T12:00:00Z");
  it("now", () => expect(formatNotifTime("2026-06-06T11:59:40Z", now)).toBe("now"));
  it("minutes", () => expect(formatNotifTime("2026-06-06T11:30:00Z", now)).toBe("30m"));
  it("heures", () => expect(formatNotifTime("2026-06-06T09:00:00Z", now)).toBe("3h"));
  it("invalide → vide", () => expect(formatNotifTime("nope", now)).toBe(""));
});
