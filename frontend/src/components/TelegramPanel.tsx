import React from "react";
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
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0B141A]">
      {/* Telegram header */}
      <div className="flex items-center justify-between border-b border-slate-800/90 bg-[#17212B] px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 shadow">
            <Bot className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-100">@AgroGuardKG_Bot</div>
            <div className="text-[10px] text-sky-400">
              {realConnected
                ? "Telegram API Live"
                : lang === "ru"
                ? "Интерактивное зеркало бота ($0)"
                : "Боттун интерактивдүү күзгүсү ($0)"}
            </div>
          </div>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
          {lang === "ru" ? "2-сторонний" : "2-тараптуу"}
        </span>
      </div>

      {/* Chat feed */}
      <div className="flex max-h-[430px] flex-1 flex-col gap-2.5 overflow-y-auto p-3">
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
                className={`max-w-[92%] rounded-2xl px-3 py-2 text-[11.5px] shadow ${
                  isFarmer
                    ? "rounded-br-sm bg-emerald-700/80 text-emerald-50"
                    : m.severity === "critical"
                    ? "rounded-bl-sm border border-rose-500/40 bg-[#182533] text-slate-100"
                    : "rounded-bl-sm border border-slate-700/60 bg-[#182533] text-slate-100"
                }`}
              >
                {m.image_b64 && (
                  <img
                    src={m.image_b64}
                    alt="Alert"
                    className="mb-2 max-h-32 w-full rounded-lg border border-slate-700/60 object-cover"
                  />
                )}
                {title && (
                  <div className="mb-0.5 text-xs font-bold text-white">{title}</div>
                )}
                <div className="whitespace-pre-line leading-relaxed text-slate-200">{text}</div>
                <div className="mt-1 flex items-center justify-end gap-1 text-[9.5px] text-slate-400">
                  <span>{m.ts}</span>
                  {isFarmer && <CheckCheck className="h-3 w-3 text-emerald-300" />}
                </div>
              </div>

              {/* Interactive inline keyboard buttons */}
              {!isFarmer && m.buttons && m.buttons.length > 0 && (
                <div className="mt-1 flex max-w-[92%] flex-wrap gap-1">
                  {m.buttons.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => onAction(b.id)}
                      className="rounded-lg border border-sky-500/30 bg-[#1E2C3A] px-2.5 py-1 text-[10.5px] font-semibold text-sky-200 transition hover:bg-sky-600/30 active:scale-95"
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

      {/* Quick farmer command bar */}
      <div className="border-t border-slate-800 bg-[#17212B] p-2">
        <div className="mb-1 text-[10px] font-semibold text-slate-400">
          {lang === "ru"
            ? "Быстрые команды фермера (управляют 3D-теплицей):"
            : "Фермердин тез буйруктары (3D-күнөскананы башкарат):"}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onAction("sprinkler_toggle")}
            className="flex items-center justify-center gap-1 rounded-lg bg-sky-500/15 px-2 py-1.5 text-[10.5px] font-semibold text-sky-200 hover:bg-sky-500/25"
          >
            <Send className="h-3 w-3" />
            {lang === "ru" ? "Полив" : "Сугаруу"}
          </button>
          <button
            onClick={() => onAction("heater_toggle")}
            className="flex items-center justify-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1.5 text-[10.5px] font-semibold text-amber-200 hover:bg-amber-500/25"
          >
            <Send className="h-3 w-3" />
            {lang === "ru" ? "Обогрев" : "Жылытуу"}
          </button>
          <button
            onClick={() => onAction("auto_on")}
            className="flex items-center justify-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1.5 text-[10.5px] font-semibold text-emerald-200 hover:bg-emerald-500/25"
          >
            <Send className="h-3 w-3" />
            {lang === "ru" ? "Авто-AI" : "Авто-AI"}
          </button>
        </div>
      </div>
    </div>
  );
};
