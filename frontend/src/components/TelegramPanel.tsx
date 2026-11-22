import React, { useEffect, useRef } from "react";
import { Send, Bot, CheckCheck } from "lucide-react";
import { Lang, TelegramMessage } from "../types";

interface Props {
  messages: TelegramMessage[];
  realConnected: boolean;
  lang: Lang;
  onAction: (command: string) => void;
}

export const TelegramPanel: React.FC<Props> = ({
  messages,
  realConnected,
  lang,
  onAction,
}) => {
  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages.length]);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/15 bg-white/5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#142014]">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-medium text-white">@AgroGuardKG_Bot</div>
            <div className="text-[10.5px] text-white/60">
              {realConnected
                ? "Telegram API Live"
                : lang === "ru"
                ? "Уведомления и команды"
                : "Билдирүүлөр жана буйруктар"}
            </div>
          </div>
        </div>
        <span className="rounded-full border border-[#B5F043]/40 bg-[#B5F043]/15 px-2 py-0.5 text-[10px] font-medium text-[#B5F043]">
          {realConnected ? "Live" : lang === "ru" ? "Локально" : "Жергиликтүү"}
        </span>
      </div>

      {/* Feed */}
      <div ref={feedRef} className="flex max-h-[360px] flex-1 flex-col gap-2.5 overflow-y-auto p-3">
        {messages.map((m) => {
          const isFarmer = m.sender === "farmer";
          const title = lang === "ru" ? m.title_ru : m.title_kg;
          const text = lang === "ru" ? m.text_ru : m.text_kg;

          return (
            <div
              key={m.id}
              className={`flex flex-col ${isFarmer ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl border px-3 py-2 text-xs ${
                  isFarmer
                    ? "rounded-br-sm border-[#B5F043]/40 bg-[#B5F043]/20 text-white"
                    : m.severity === "critical"
                    ? "rounded-bl-sm border-[#FF6B6B]/45 bg-[#FF6B6B]/18 text-white"
                    : "rounded-bl-sm border-white/15 bg-white/10 text-white"
                }`}
              >
                {m.image_b64 && (
                  <img
                    src={m.image_b64}
                    alt="Alert"
                    className="mb-2 max-h-28 w-full rounded-xl border border-white/15 object-cover"
                  />
                )}
                {title && <div className="mb-0.5 font-medium text-white">{title}</div>}
                <div className="whitespace-pre-line leading-relaxed text-white/85">{text}</div>
                <div className="font-mono-num mt-1 flex items-center justify-end gap-1 text-[10px] text-white/55">
                  <span>{m.ts}</span>
                  {isFarmer && <CheckCheck className="h-3 w-3 text-[#B5F043]" />}
                </div>
              </div>

              {!isFarmer && m.buttons && m.buttons.length > 0 && (
                <div className="mt-1.5 flex max-w-[92%] flex-wrap gap-1">
                  {m.buttons.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onAction(b.id)}
                      className="liquid-pill rounded-full px-2.5 py-1 text-[10.5px] font-medium text-white transition-all"
                    >
                      {lang === "ru" ? b.label_ru : b.label_kg}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Commands */}
      <div className="border-t border-white/15 bg-white/5 p-2.5">
        <div className="mb-1.5 text-[10.5px] text-white/60">
          {lang === "ru" ? "Быстрые команды:" : "Тез буйруктар:"}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => onAction("sprinkler_toggle")}
            className="liquid-pill flex items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium text-[#7DD3FC]"
          >
            <Send className="h-3 w-3" />
            {lang === "ru" ? "Полив" : "Сугаруу"}
          </button>
          <button
            type="button"
            onClick={() => onAction("heater_toggle")}
            className="liquid-pill flex items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium text-[#FBBF24]"
          >
            <Send className="h-3 w-3" />
            {lang === "ru" ? "Обогрев" : "Жылытуу"}
          </button>
          <button
            type="button"
            onClick={() => onAction("auto_on")}
            className="liquid-pill flex items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium text-[#B5F043]"
          >
            <Send className="h-3 w-3" />
            {lang === "ru" ? "Авто" : "Авто"}
          </button>
        </div>
      </div>
    </div>
  );
};
