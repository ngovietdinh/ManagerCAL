// Bảng → thẻ trên điện thoại: gán nhãn cột (data-label) và vai trò từng ô cho CSS ở index.css.
// Làm một lần cho mọi bảng (kể cả trong hộp thoại), tự cập nhật khi bảng vẽ lại.
import { useEffect } from "react";

const SELECTOR = "table.table:not(.table--grid)";

function labelTable(t: HTMLTableElement) {
  const head = t.tHead?.rows[0];
  const labels: string[] = [];
  if (head) for (const th of Array.from(head.cells)) for (let i = 0; i < th.colSpan; i++) labels.push((th.textContent ?? "").trim());
  for (const body of Array.from(t.tBodies)) {
    for (const tr of Array.from(body.rows)) {
      let col = 0;
      let main = false;
      for (const td of Array.from(tr.cells)) {
        const lbl = labels[col] ?? "";
        col += td.colSpan;
        const text = (td.textContent ?? "").trim();
        const isCheck = !!td.querySelector('input[type="checkbox"]') && !text;
        const blank = !text && !td.querySelector("button, a, select, input, svg, img");
        // tiêu đề thẻ: ô đầu tiên có chữ thật (không phải ô chỉ chứa ô nhập, không phải "–")
        const isMain = !isCheck && !blank && !main && td.colSpan === 1 && !!text && text !== "–";
        if (isMain) main = true;
        const interactive = !!td.querySelector("button, a, select, input");
        td.classList.toggle("cell-check", isCheck);
        td.classList.toggle("cell-main", isMain);
        td.classList.toggle("cell-actions", !isCheck && !isMain && !lbl && interactive);
        td.classList.toggle("cell-wide", !isCheck && !isMain && ((!lbl && !interactive) || td.querySelectorAll("input").length > 1));
        td.classList.toggle("cell-empty", !isMain && !isCheck && (text === "" || text === "–") && !interactive && !td.querySelector("svg, img"));
        if (lbl && !isMain && !isCheck) { if (td.dataset.label !== lbl) td.dataset.label = lbl; }
        else if (td.dataset.label !== undefined) delete td.dataset.label;
      }
    }
  }
}

/** Tờ A4 (GCN, phiếu tiếp nhận) rộng 210 mm: co lại cho vừa màn hình hẹp (khi in vẫn đúng khổ, xem @media print) */
const A4_PX = (210 * 96) / 25.4;
function fitDocs() {
  for (const d of Array.from(document.querySelectorAll<HTMLElement>(".doc"))) {
    const w = d.parentElement?.clientWidth ?? A4_PX;
    const z = Math.min(1, w / A4_PX);
    const v = z < 0.999 ? String(Math.floor(z * 1000) / 1000) : "";
    if (d.style.zoom !== v) d.style.zoom = v;
  }
}

export function useCardTables() {
  useEffect(() => {
    let raf = 0;
    const run = () => { for (const t of Array.from(document.querySelectorAll<HTMLTableElement>(SELECTOR))) labelTable(t); fitDocs(); };
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(run); };
    window.addEventListener("resize", onResize);
    const obs = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(run); });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    run();
    return () => { obs.disconnect(); cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);
}
