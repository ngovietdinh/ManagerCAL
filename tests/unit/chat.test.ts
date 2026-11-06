import { beforeAll, describe, expect, it } from "vitest";
import { LocalRepo } from "@/lib/store/local";
import { Services } from "@/lib/services";
import { GENERAL, dmChannel } from "@/lib/services/chat";
import { seedDemo, demoUsers } from "@/lib/seed/demo";
import type { User } from "@/lib/types";

const USERS = demoUsers();
let repo: LocalRepo;
let current: User | null = null;
let svc: Services;
const as = (id: string) => { current = USERS.find((u) => u.id === id)!; };

beforeAll(async () => {
  repo = new LocalRepo({ memoryOnly: true });
  await seedDemo(repo);
  svc = new Services(repo, () => current);
});

describe("trao đổi nội bộ", () => {
  it("dữ liệu mẫu: kênh chung có tin, Dung có lời nhờ soát xét chưa đọc", async () => {
    as("u-dung");
    const s = await svc.chatSummary();
    expect(s[0].id).toBe(GENERAL);
    const dm = s.find((c) => c.id === dmChannel("u-cuong", "u-dung"))!;
    expect(dm.unread).toBe(1);
    const msgs = await svc.chatList(dm.id);
    expect(msgs[0].ask).toMatchObject({ kind: "review", to_user_id: "u-dung", status: "open" });
    expect(msgs[0].refs[0]).toMatchObject({ kind: "job" });
    await svc.chatRead(dm.id);
    expect((await svc.chatSummary()).find((c) => c.id === dm.id)!.unread).toBe(0);
  });

  it("người ngoài không đọc được tin riêng; bảng chat không sửa được qua hàm chung", async () => {
    as("u-giang");
    await expect(svc.chatList(dmChannel("u-cuong", "u-dung"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await svc.chatSummary()).some((c) => c.id.startsWith("dm:u-cuong"))).toBe(false);
    as("u-an");
    await expect(svc.patch("settings", "chat_messages", "x", {} as never)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("gõ mã phiếu trong tin → tự thành trích dẫn với nhãn lấy từ dữ liệu thật", async () => {
    const job = (await repo.list("jobs"))[0];
    as("u-em");
    const m = await svc.chatSend({ channel: GENERAL, text: `Khách hỏi tiến độ ${job.code} ạ`, refs: [{ kind: "job", id: job.id }, { kind: "job", id: "khong-co" }] });
    expect(m.refs).toHaveLength(1);
    expect(m.refs[0].label).toBe(job.code);
  });

  it("lời nhờ: chỉ trong tin riêng, phải trích phiếu; chỉ người được nhờ trả lời; có thông báo + email cho người nhận", async () => {
    const job = (await repo.list("jobs", { where: { status: "approval" } }))[0];
    as("u-dung");
    const ch = dmChannel("u-dung", "u-an");
    await expect(svc.chatSend({ channel: GENERAL, text: "x", refs: [{ kind: "job", id: job.id }], ask: { kind: "sign", to_user_id: "u-an" } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(svc.chatSend({ channel: ch, text: "ký giúp", ask: { kind: "sign", to_user_id: "u-an" } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const m = await svc.chatSend({ channel: ch, text: "Anh ký giúp em", refs: [{ kind: "job", id: job.id }], ask: { kind: "sign", to_user_id: "u-an" } });
    const n = (await repo.list("notifications", { where: { user_id: "u-an" } })).find((x) => x.title.includes(job.code) && x.title.includes("ký phát hành"))!;
    expect(n.email).toBe(true);
    expect(n.link).toBe(`/chat/${encodeURIComponent(ch)}`);
    await expect(svc.chatAnswer(m.id, "done")).rejects.toMatchObject({ code: "FORBIDDEN" });
    as("u-an");
    const r = await svc.chatAnswer(m.id, "accepted");
    expect(r.ask?.status).toBe("accepted");
    const last = (await svc.chatList(ch)).at(-1)!;
    expect(last.user_id).toBe("u-an");
    expect(last.text).toContain("Đã nhận");
  });

  it("phân trang: lấy tin cũ hơn mốc thời gian", async () => {
    as("u-binh");
    const ch = dmChannel("u-binh", "u-hung");
    for (let i = 0; i < 7; i++) await svc.chatSend({ channel: ch, text: `tin ${i}` });
    const last3 = await svc.chatList(ch, null, 3);
    expect(last3.map((m) => m.text)).toEqual(["tin 4", "tin 5", "tin 6"]);
    const before = await svc.chatList(ch, last3[0].created_at, 3);
    expect(before.every((m) => m.created_at < last3[0].created_at)).toBe(true);
  });

  it("giao việc gắn cờ email cho người được phân công", async () => {
    as("u-dung");
    const job = (await repo.list("jobs", { where: { status: "received" } })).find((j) => j.instrument_type_id === "it-qt-ph")!;
    await svc.assignJob(job.id, { assignee_id: "u-binh", reviewer_id: null, due_date: null, priority: "normal" });
    const n = (await repo.list("notifications", { where: { user_id: "u-binh" } })).find((x) => x.title.includes(job.code))!;
    expect(n.email).toBe(true);
  });
});
