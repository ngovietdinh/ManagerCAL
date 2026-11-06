// Trang trao đổi nội bộ (điện thoại, và khi mở từ thông báo / email)
import { useNavigate, useParams } from "react-router-dom";
import ChatView from "@/components/chat/ChatView";
import { useEffect, useState } from "react";

export default function Chat() {
  const { channel } = useParams();
  const nav = useNavigate();
  const [narrow, setNarrow] = useState(() => !window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const h = () => setNarrow(!mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  const ch = channel ? decodeURIComponent(channel) : null;
  return (
    <div className="card h-[calc(100dvh-86px-7.5rem)] p-2 lg:h-[calc(100dvh-86px-2rem)] lg:p-3">
      <ChatView narrow={narrow} channel={ch} onChannel={(c) => nav(c ? `/chat/${encodeURIComponent(c)}` : "/chat", { replace: !!ch && !!c })} />
    </div>
  );
}
