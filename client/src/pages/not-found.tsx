import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="playful-shell min-h-screen flex items-center justify-center px-4">
      <div className="relative z-10 playful-card p-8 sm:p-12 max-w-md w-full text-center">
        <div className="text-7xl mb-3">🧭</div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
          找不到這個頁面
        </h1>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          連結可能輸錯了，或者題目已經被刪除。
          <br />回到首頁建立新題目，或請學生重新掃 QR Code。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button className="playful-cta w-full sm:w-auto h-11 px-5 rounded-2xl gap-2">
              <Home className="w-4 h-4" />回首頁
            </Button>
          </Link>
          <Link href="/join">
            <Button variant="outline" className="w-full sm:w-auto h-11 px-5 rounded-2xl gap-2 bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50">
              <Compass className="w-4 h-4" />輸入房間代碼
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
