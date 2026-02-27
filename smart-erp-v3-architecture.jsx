import { useState } from "react";

const tabs = ["Architecture", "Auth Strategy", "Deploy Flow", "Cost", "Roadmap"];

function ArchitectureTab() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "Georgia, serif" }}>
          🏗️ System Architecture — Smart ERP v3
        </h2>
        <p className="text-slate-400 text-sm">
          Vercel (Frontend) + Railway (Backend + DB + Redis) — git push = deploy
        </p>
      </div>

      {/* Main Diagram */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-7">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">System Diagram</h3>

        {/* Users */}
        <div className="flex justify-center mb-3">
          <div className="bg-sky-50 border-2 border-sky-200 rounded-xl px-8 py-3 text-center shadow-sm">
            <div className="text-2xl mb-1">👥</div>
            <div className="font-bold text-sky-800 text-sm">Users (Browser / Mobile)</div>
          </div>
        </div>
        <div className="flex justify-center mb-3">
          <div className="w-0.5 h-5 bg-slate-300"></div>
        </div>

        {/* Cloudflare */}
        <div className="flex justify-center mb-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-6 py-2 text-center">
            <div className="font-bold text-amber-700 text-xs">🌐 Cloudflare DNS + SSL (Free)</div>
          </div>
        </div>
        <div className="flex justify-center mb-3">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center">
              <div className="text-xs text-slate-400 mb-1">erp.yourdomain.com</div>
              <div className="w-0.5 h-5 bg-slate-300"></div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-xs text-slate-400 mb-1">api.yourdomain.com</div>
              <div className="w-0.5 h-5 bg-slate-300"></div>
            </div>
          </div>
        </div>

        {/* Two platforms side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {/* Vercel */}
          <div className="border-2 border-dashed border-slate-800 rounded-2xl p-4 bg-slate-50">
            <div className="text-center mb-3">
              <span className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full">
                ▲ Vercel
              </span>
            </div>
            <div className="bg-white border border-cyan-200 rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">⚛️</div>
              <div className="font-bold text-cyan-800 text-sm">React 18 + Vite</div>
              <div className="text-xs text-cyan-600 mt-1">Static SPA + Ant Design</div>
              <div className="text-xs text-cyan-500 mt-0.5">Global CDN • Preview per PR</div>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>Auto deploy จาก GitHub
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>Edge caching ทั่วโลก
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>Preview URL ทุก PR
              </div>
            </div>
          </div>

          {/* Railway */}
          <div className="border-2 border-dashed border-purple-700 rounded-2xl p-4 bg-purple-50/30">
            <div className="text-center mb-3">
              <span className="bg-purple-700 text-white text-xs font-bold px-3 py-1 rounded-full">
                🚂 Railway
              </span>
            </div>

            <div className="space-y-3">
              <div className="bg-white border border-indigo-200 rounded-xl p-3 text-center">
                <div className="text-lg mb-0.5">🐍</div>
                <div className="font-bold text-indigo-800 text-sm">FastAPI Backend</div>
                <div className="text-xs text-indigo-500">REST API + RBAC 89 perms</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white border border-blue-200 rounded-xl p-3 text-center">
                  <div className="text-lg mb-0.5">🐘</div>
                  <div className="font-bold text-blue-800 text-xs">PostgreSQL 16</div>
                  <div className="text-xs text-blue-500">Multi-tenant</div>
                </div>
                <div className="bg-white border border-red-200 rounded-xl p-3 text-center">
                  <div className="text-lg mb-0.5">🔴</div>
                  <div className="font-bold text-red-800 text-xs">Redis</div>
                  <div className="text-xs text-red-500">Rate Limit</div>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>Auto deploy จาก GitHub
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>Internal network (DB ไม่ expose)
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>Auto restart + health check
              </div>
            </div>
          </div>
        </div>

        {/* Connection Arrow */}
        <div className="flex justify-center mb-4">
          <div className="bg-gradient-to-r from-cyan-100 via-slate-100 to-purple-100 border border-slate-200 rounded-xl px-6 py-3 text-center">
            <div className="text-xs font-bold text-slate-600">
              ⚛️ React → <span className="text-amber-600">HTTPS + Bearer Token</span> → 🐍 FastAPI
            </div>
            <div className="text-xs text-slate-400 mt-1">
              CORS: erp.yourdomain.com → api.yourdomain.com
            </div>
          </div>
        </div>

        {/* External Services */}
        <div className="flex justify-center gap-3 flex-wrap">
          {[
            { icon: "📦", name: "Cloudflare R2", desc: "File Storage (Free 10GB)", color: "amber" },
            { icon: "📧", name: "Resend", desc: "Email (Free 100/day)", color: "blue" },
            { icon: "📊", name: "Sentry", desc: "Error Tracking (Free)", color: "rose" },
            { icon: "🔔", name: "LINE Notify", desc: "Alerts (Free)", color: "green" },
          ].map((svc, i) => (
            <div key={i} className={`bg-${svc.color}-50 border border-${svc.color}-200 rounded-lg px-3 py-2 text-center`}
                 style={{ backgroundColor: `var(--${svc.color})`, border: '1px solid #e2e8f0' }}>
              <div className="font-bold text-slate-700 text-xs">{svc.icon} {svc.name}</div>
              <div className="text-xs text-slate-400">{svc.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Decisions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">ทำไมเลือก Architecture นี้?</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { icon: "🎯", title: "แยก Frontend / Backend", desc: "Vercel cache static ดีมาก, Railway จัดการ API อิสระ → scale แยกกันได้" },
            { icon: "⚡", title: "Zero DevOps", desc: "git push = deploy ทั้ง 2 ฝั่ง ไม่ต้องแตะ Docker, Nginx, หรือ server เลย" },
            { icon: "🔒", title: "Security", desc: "Railway internal network → DB/Redis ไม่ expose, CORS whitelist เฉพาะ domain" },
            { icon: "📈", title: "Scale เมื่อโต", desc: "เพิ่ม Railway replicas ได้ทันที, Vercel scale อัตโนมัติ, เปลี่ยน managed DB ง่าย" },
            { icon: "🔄", title: "Monolith-first", desc: "FastAPI app เดียวครบ 11 modules — ไม่ต้องจัดการ microservices ตอนนี้" },
            { icon: "💰", title: "Cost-effective", desc: "ใช้ subscription ที่มีอยู่ ไม่ต้องเพิ่มค่าใช้จ่ายใหม่มาก" },
          ].map((item, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-xl">{item.icon}</span>
              <div>
                <div className="font-bold text-slate-800 text-sm">{item.title}</div>
                <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthTab() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "Georgia, serif" }}>
          🔐 Auth Strategy — Bearer Token (แนะนำ)
        </h2>
        <p className="text-emerald-300 text-sm">
          เหมาะกับ Vercel + Railway (cross-origin) — ง่ายกว่า httpOnly cookie
        </p>
      </div>

      {/* Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border-2 border-emerald-300 p-5 relative">
          <div className="absolute -top-3 left-4">
            <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">🏆 แนะนำ</span>
          </div>
          <h3 className="font-bold text-slate-800 mt-2 mb-3">Bearer Token (Header)</h3>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2"><span className="text-emerald-500">✅</span><span className="text-slate-600">Cross-origin ง่าย — ไม่ต้อง SameSite/Secure</span></div>
            <div className="flex gap-2"><span className="text-emerald-500">✅</span><span className="text-slate-600">CORS config เรียบง่าย</span></div>
            <div className="flex gap-2"><span className="text-emerald-500">✅</span><span className="text-slate-600">Mobile app ใช้ได้เลย (ถ้าทำทีหลัง)</span></div>
            <div className="flex gap-2"><span className="text-emerald-500">✅</span><span className="text-slate-600">Debug ง่าย — เห็น token ใน DevTools</span></div>
            <div className="flex gap-2"><span className="text-amber-500">⚠️</span><span className="text-slate-600">เก็บใน memory (Zustand) — XSS ต้องระวัง</span></div>
          </div>
          <div className="mt-4 bg-slate-50 rounded-lg p-3">
            <div className="text-xs font-mono text-slate-600">
              <div className="text-slate-400 mb-1">// ทุก API request</div>
              <div>Authorization: Bearer {'<'}access_token{'>'}</div>
              <div className="mt-2 text-slate-400">// Token เก็บใน Zustand store</div>
              <div>// Access: 15 นาที / Refresh: 7 วัน</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 opacity-70">
          <h3 className="font-bold text-slate-800 mb-3">httpOnly Cookie</h3>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2"><span className="text-emerald-500">✅</span><span className="text-slate-600">ป้องกัน XSS ได้ดี (JS อ่าน cookie ไม่ได้)</span></div>
            <div className="flex gap-2"><span className="text-red-500">❌</span><span className="text-slate-600">Cross-origin ยาก — ต้อง SameSite=None + Secure</span></div>
            <div className="flex gap-2"><span className="text-red-500">❌</span><span className="text-slate-600">Safari/iOS block 3rd-party cookies</span></div>
            <div className="flex gap-2"><span className="text-red-500">❌</span><span className="text-slate-600">CSRF protection เพิ่ม complexity</span></div>
            <div className="flex gap-2"><span className="text-red-500">❌</span><span className="text-slate-600">Mobile app ใช้ยาก</span></div>
          </div>
          <div className="mt-4 bg-red-50 rounded-lg p-3 text-xs text-red-600">
            ⚠️ Vercel + Railway = คนละ domain → cookie cross-origin มีปัญหากับ Safari/iOS ที่ block 3rd-party cookies
          </div>
        </div>
      </div>

      {/* Auth Flow Diagram */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Auth Flow (Bearer Token + Refresh)</h3>

        <div className="space-y-3">
          {[
            { step: 1, actor: "👤 User", action: "POST /api/auth/login", detail: "{ email, password }", color: "bg-blue-500" },
            { step: 2, actor: "🐍 FastAPI", action: "Verify → สร้าง Token คู่", detail: "access_token (15 นาที) + refresh_token (7 วัน)", color: "bg-indigo-500" },
            { step: 3, actor: "⚛️ React", action: "เก็บ token ใน Zustand", detail: "access → memory, refresh → memory (ไม่เก็บ localStorage)", color: "bg-cyan-500" },
            { step: 4, actor: "⚛️ React", action: "ทุก API call ใส่ Header", detail: "Authorization: Bearer <access_token>", color: "bg-cyan-500" },
            { step: 5, actor: "🐍 FastAPI", action: "Token หมดอายุ → 401", detail: "React auto call /api/auth/refresh ด้วย refresh_token", color: "bg-amber-500" },
            { step: 6, actor: "🐍 FastAPI", action: "ส่ง access_token ใหม่", detail: "Seamless — user ไม่ต้อง login ใหม่ภายใน 7 วัน", color: "bg-green-500" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className={`${item.color} text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                {item.step}
              </div>
              <div className="flex-1 bg-slate-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{item.actor}</span>
                  <span className="font-bold text-slate-800 text-sm">{item.action}</span>
                </div>
                <div className="text-xs text-slate-500 font-mono">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="font-bold text-emerald-800 text-sm mb-2">🛡️ Security Measures</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-emerald-700">
            <div>• Access Token สั้น (15 นาที) → ลด risk ถ้า leak</div>
            <div>• Refresh Token rotate ทุกครั้งที่ใช้</div>
            <div>• Rate Limit: 5 req/min/IP บน /login</div>
            <div>• RBAC check ทุก endpoint (89 permissions)</div>
            <div>• Token เก็บใน memory เท่านั้น (ไม่ใช่ localStorage)</div>
            <div>• CORS whitelist เฉพาะ erp.yourdomain.com</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeployFlowTab() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "Georgia, serif" }}>
          🚀 Deploy Flow — git push = live
        </h2>
        <p className="text-purple-300 text-sm">ทั้ง Frontend + Backend auto deploy จาก GitHub</p>
      </div>

      {/* Repo Structure */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">📁 Monorepo Structure</h3>
        <div className="bg-slate-900 rounded-xl p-5 font-mono text-sm text-slate-300 leading-relaxed">
          <div className="text-amber-400">smart-erp/</div>
          <div className="text-slate-500">├── <span className="text-cyan-400">frontend/</span>              ← Vercel deploys นี้</div>
          <div className="text-slate-500">│   ├── src/</div>
          <div className="text-slate-500">│   ├── package.json</div>
          <div className="text-slate-500">│   └── vite.config.ts</div>
          <div className="text-slate-500">├── <span className="text-indigo-400">backend/</span>               ← Railway deploys นี้</div>
          <div className="text-slate-500">│   ├── app/</div>
          <div className="text-slate-500">│   │   ├── api/            <span className="text-slate-600"># route handlers</span></div>
          <div className="text-slate-500">│   │   ├── core/           <span className="text-slate-600"># auth, rbac, config</span></div>
          <div className="text-slate-500">│   │   ├── models/         <span className="text-slate-600"># SQLAlchemy models</span></div>
          <div className="text-slate-500">│   │   ├── schemas/        <span className="text-slate-600"># Pydantic schemas</span></div>
          <div className="text-slate-500">│   │   ├── services/       <span className="text-slate-600"># business logic</span></div>
          <div className="text-slate-500">│   │   └── main.py</div>
          <div className="text-slate-500">│   ├── alembic/            <span className="text-slate-600"># DB migrations</span></div>
          <div className="text-slate-500">│   ├── Dockerfile</div>
          <div className="text-slate-500">│   └── requirements.txt</div>
          <div className="text-slate-500">├── <span className="text-green-400">docker-compose.yml</span>     ← Local dev</div>
          <div className="text-slate-500">├── <span className="text-green-400">docker-compose.dev.yml</span></div>
          <div className="text-slate-500">└── <span className="text-yellow-400">README.md</span></div>
        </div>
      </div>

      {/* Deploy Flows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vercel Flow */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-slate-900 text-white text-xs font-bold px-2.5 py-1 rounded-full">▲</span>
            <span className="font-bold text-slate-800">Vercel — Frontend</span>
          </div>
          {[
            "git push → GitHub",
            "Vercel detect เปลี่ยนใน frontend/",
            "Build: npm run build (Vite)",
            "Deploy → Global CDN",
            "Preview URL สำหรับ PR",
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <div className="bg-slate-800 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">{i + 1}</div>
              <span className="text-sm text-slate-600">{step}</span>
            </div>
          ))}
          <div className="mt-3 bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
            <span className="font-bold">Settings:</span> Root Directory = frontend/
          </div>
        </div>

        {/* Railway Flow */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-purple-700 text-white text-xs font-bold px-2.5 py-1 rounded-full">🚂</span>
            <span className="font-bold text-slate-800">Railway — Backend</span>
          </div>
          {[
            "git push → GitHub",
            "Railway detect เปลี่ยนใน backend/",
            "Build: Docker image (Dockerfile)",
            "Run Alembic migrations",
            "Deploy → Health check → Live",
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <div className="bg-purple-700 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">{i + 1}</div>
              <span className="text-sm text-slate-600">{step}</span>
            </div>
          ))}
          <div className="mt-3 bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
            <span className="font-bold">Settings:</span> Root Directory = backend/ • Watch Paths = backend/**
          </div>
        </div>
      </div>

      {/* Local Dev */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">🖥️ Local Development</h3>
        <div className="bg-slate-900 rounded-xl p-5 font-mono text-sm text-slate-300 space-y-1">
          <div className="text-slate-500"># Clone + Start ทุกอย่างด้วยคำสั่งเดียว</div>
          <div className="text-green-400">$ git clone https://github.com/you/smart-erp.git</div>
          <div className="text-green-400">$ cd smart-erp</div>
          <div className="text-green-400">$ docker compose -f docker-compose.dev.yml up</div>
          <div className="mt-2 text-slate-500"># Frontend: http://localhost:5173 (Vite hot-reload)</div>
          <div className="text-slate-500"># Backend:  http://localhost:8000 (FastAPI + auto-reload)</div>
          <div className="text-slate-500"># API Docs: http://localhost:8000/docs (Swagger UI)</div>
          <div className="text-slate-500"># DB:       localhost:5432 (PostgreSQL)</div>
        </div>
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          💡 docker-compose.dev.yml = hot-reload ทั้ง frontend + backend — แก้โค้ดแล้วเห็นผลทันที
        </div>
      </div>
    </div>
  );
}

function CostTab() {
  const items = [
    { name: "Vercel (Pro)", cost: "มีแล้ว", note: "Frontend hosting + CDN + Preview", free: true },
    { name: "Railway (Pro)", cost: "มีแล้ว", note: "Backend + DB + Redis", free: true },
    { name: "Railway Usage (est.)", cost: "$10-20", note: "FastAPI + PostgreSQL + Redis compute", free: false },
    { name: "Cloudflare DNS", cost: "FREE", note: "DNS + SSL + DDoS protection", free: true },
    { name: "Cloudflare R2", cost: "FREE", note: "File storage (10GB free)", free: true },
    { name: "Resend (Email)", cost: "FREE", note: "100 emails/day free", free: true },
    { name: "Sentry", cost: "FREE", note: "Error tracking (5K events/mo)", free: true },
    { name: "GitHub (Free)", cost: "FREE", note: "Code + Actions CI/CD (2K min/mo)", free: true },
    { name: "Domain (.com)", cost: "~$1", note: "~$12/ปี", free: false },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-violet-900 to-violet-800 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "Georgia, serif" }}>
          💰 Cost Breakdown — Vercel + Railway
        </h2>
        <p className="text-violet-300 text-sm">ใช้ subscription ที่มีอยู่ ค่าเพิ่มแค่ usage</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left p-4 font-bold text-slate-600">Service</th>
              <th className="text-left p-4 font-bold text-slate-600 hidden md:table-cell">Note</th>
              <th className="text-right p-4 font-bold text-slate-600">$/เดือน</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="p-4">
                  <div className="font-medium text-slate-800">{item.name}</div>
                  <div className="text-xs text-slate-400 md:hidden mt-0.5">{item.note}</div>
                </td>
                <td className="p-4 text-slate-500 text-xs hidden md:table-cell">{item.note}</td>
                <td className="p-4 text-right font-bold">
                  {item.free ? (
                    <span className="text-emerald-600">{item.cost}</span>
                  ) : (
                    <span className="text-slate-800">{item.cost}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800 text-white">
              <td className="p-4 font-bold" colSpan={2}>ค่าใช้จ่ายเพิ่มเติมจริง</td>
              <td className="p-4 text-right font-bold text-xl">~$11-21</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
        <div className="text-3xl font-black text-emerald-800" style={{ fontFamily: "Georgia, serif" }}>~$11-21/เดือน</div>
        <div className="text-sm text-emerald-600 mt-1">สำหรับ ERP ที่รองรับ 1-5 บริษัท, &lt;50 users</div>
        <div className="text-xs text-emerald-500 mt-1">เพราะมี Vercel + Railway subscription อยู่แล้ว</div>
      </div>
    </div>
  );
}

function RoadmapTab() {
  const phases = [
    {
      phase: "Phase 0", title: "Foundation", duration: "Session นี้", color: "bg-red-500", borderColor: "border-red-200",
      tasks: [
        { name: "Monorepo structure (frontend/ + backend/)", status: "todo" },
        { name: "Docker Compose (dev) — FastAPI + PG + Redis", status: "todo" },
        { name: "Dockerfile (production) for Railway", status: "todo" },
        { name: "Alembic migration setup + base models", status: "todo" },
        { name: "Auth — JWT Bearer Token (access + refresh)", status: "todo" },
        { name: "RBAC core — 89 permissions, 5 roles, middleware", status: "todo" },
        { name: "Rate Limiting (slowapi + Redis)", status: "todo" },
        { name: "CORS config (Vercel ↔ Railway)", status: "todo" },
      ]
    },
    {
      phase: "Phase 1", title: "Core Modules", duration: "1-2 สัปดาห์", color: "bg-amber-500", borderColor: "border-amber-200",
      tasks: [
        { name: "Master Data — Products, Categories, Units, OT Types", status: "todo" },
        { name: "Inventory — RECEIVE, ISSUE, TRANSFER, ADJUST (immutable)", status: "todo" },
        { name: "Warehouse Management", status: "todo" },
        { name: "Work Orders — CRUD + Status flow", status: "todo" },
        { name: "Pagination + Search + Filter ทุก list endpoint", status: "todo" },
      ]
    },
    {
      phase: "Phase 2", title: "HR + Job Costing", duration: "1-2 สัปดาห์", color: "bg-blue-500", borderColor: "border-blue-200",
      tasks: [
        { name: "Employee + Rate CRUD", status: "todo" },
        { name: "Timesheet — กรอก → approve → final → lock 7 วัน", status: "todo" },
        { name: "OT System — types/factor/ceiling/approve flow", status: "todo" },
        { name: "Tools Module — CRUD + check-in/out + auto recharge WO", status: "todo" },
        { name: "WO Cost Summary API (Material + ManHour + Tools + Overhead)", status: "todo" },
        { name: "Payroll execute + export", status: "todo" },
      ]
    },
    {
      phase: "Phase 3", title: "Business Flow + Frontend", duration: "2-3 สัปดาห์", color: "bg-green-500", borderColor: "border-green-200",
      tasks: [
        { name: "Purchasing — PO → GR → RECEIVE", status: "todo" },
        { name: "Sales Orders + Invoicing", status: "todo" },
        { name: "Finance Reports", status: "todo" },
        { name: "React Frontend — ทุก module (Ant Design)", status: "todo" },
        { name: "Admin Panel — manage roles/permissions", status: "todo" },
      ]
    },
    {
      phase: "Phase 4", title: "Multi-tenant + Production", duration: "1-2 สัปดาห์", color: "bg-purple-500", borderColor: "border-purple-200",
      tasks: [
        { name: "Multi-tenant — org_id + Setup Wizard (Preset + Fine-tune)", status: "todo" },
        { name: "Deploy production (Vercel + Railway)", status: "todo" },
        { name: "Automated backup + monitoring (Sentry)", status: "todo" },
        { name: "Security audit + load test", status: "todo" },
      ]
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-rose-900 to-rose-800 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "Georgia, serif" }}>
          📅 Implementation Roadmap
        </h2>
        <p className="text-rose-300 text-sm">Phase 0–4 • ประมาณ 6-9 สัปดาห์ถึง Production</p>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {phases.map((phase, pi) => (
          <div key={pi} className={`bg-white rounded-2xl border ${phase.borderColor} p-5`}>
            <div className="flex items-center gap-3 mb-4">
              <span className={`${phase.color} text-white text-xs font-bold px-3 py-1.5 rounded-full`}>
                {phase.phase}
              </span>
              <div>
                <div className="font-bold text-slate-800">{phase.title}</div>
                <div className="text-xs text-slate-400">{phase.duration}</div>
              </div>
              {pi === 0 && (
                <span className="ml-auto bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                  ◀ เริ่มที่นี่
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {phase.tasks.map((task, ti) => (
                <div key={ti} className="flex items-center gap-2 text-sm text-slate-600 py-1 px-2 rounded-lg hover:bg-slate-50">
                  <div className={`w-2 h-2 rounded-full ${phase.color} flex-shrink-0`}></div>
                  {task.name}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SmartERPv3Architecture() {
  const [activeTab, setActiveTab] = useState("Architecture");

  const tabIcons = {
    "Architecture": "🏗️",
    "Auth Strategy": "🔐",
    "Deploy Flow": "🚀",
    "Cost": "💰",
    "Roadmap": "📅",
  };

  return (
    <div className="min-h-screen bg-slate-100 p-3 md:p-8" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
            Smart ERP v3
          </h1>
          <p className="text-slate-400 text-sm mt-1">Vercel + Railway + PostgreSQL • Architecture & Deployment Plan</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-white rounded-xl p-1 mb-6 shadow-sm border border-slate-200 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 px-3 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab
                  ? "bg-slate-800 text-white shadow-md"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              {tabIcons[tab]} {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "Architecture" && <ArchitectureTab />}
        {activeTab === "Auth Strategy" && <AuthTab />}
        {activeTab === "Deploy Flow" && <DeployFlowTab />}
        {activeTab === "Cost" && <CostTab />}
        {activeTab === "Roadmap" && <RoadmapTab />}

        {/* Final Tech Stack */}
        <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">📦 Final Tech Stack — Smart ERP v3</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Backend", value: "FastAPI", sub: "Python 3.12" },
              { label: "Frontend", value: "React 18", sub: "Vite + Ant Design" },
              { label: "Database", value: "PostgreSQL 16", sub: "Alembic migrations" },
              { label: "Cache", value: "Redis", sub: "Rate limit + cache" },
              { label: "ORM", value: "SQLAlchemy 2.0", sub: "Async + Numeric(12,2)" },
              { label: "Auth", value: "JWT Bearer", sub: "Access + Refresh token" },
              { label: "State", value: "Zustand", sub: "Lightweight + devtools" },
              { label: "Deploy", value: "Vercel + Railway", sub: "git push = live" },
            ].map((item, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-3 text-center hover:bg-slate-100 transition-colors">
                <div className="text-xs text-slate-400 uppercase font-bold">{item.label}</div>
                <div className="font-bold text-slate-800 text-sm mt-1">{item.value}</div>
                <div className="text-xs text-slate-500">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 mt-6 pb-4">
          Smart ERP v3 Architecture Plan • Based on Master Document v2 Design • 2026-02-26
        </div>
      </div>
    </div>
  );
}
