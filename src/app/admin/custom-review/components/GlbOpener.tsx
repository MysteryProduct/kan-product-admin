'use client';

import dynamic from 'next/dynamic';
import { useId, useState } from 'react';
import { checkGlbName, type GlbCheck } from '@/lib/custom-review';

const ModelViewer = dynamic(() => import('../../custom-templates/components/ModelViewer'), { ssr: false });

type State =
  | { mode: 'empty' }
  /** `webgl`: this browser cannot draw 3D, which says nothing about the file. */
  | { mode: 'error'; name: string; cause: 'file' | 'webgl' | 'other' }
  | { mode: 'loading' | 'open'; name: string; bytes: ArrayBuffer; check: GlbCheck };

/**
 * D6: the employee picks the `…_model.glb` they extracted from the customer's ZIP.
 * The file is read with `File.arrayBuffer()` and drawn in this tab only: it is not
 * uploaded, proxied or stored anywhere (no request, no browser storage), and it is
 * dropped when the request changes or the page closes.
 */
export default function GlbOpener({ base, revision, label }: { base: string; revision: number; label: string }) {
  const [state, setState] = useState<State>({ mode: 'empty' });
  const inputId = useId();

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const check = checkGlbName(file.name, base);
    if (check.kind === 'not-glb') {
      setState({ mode: 'error', name: file.name, cause: 'file' });
      return;
    }
    try {
      const bytes = await file.arrayBuffer();
      setState({ mode: 'loading', name: file.name, bytes, check });
    } catch {
      setState({ mode: 'error', name: file.name, cause: 'other' });
    }
  };

  const picker = (text: string, small = false) => (
    <label className={`ka-btn ka-cr-filebtn${small ? ' ka-btn--sm' : ''}`} htmlFor={inputId}>
      {text}
      <input id={inputId} className="ka-cr-vh" type="file" accept=".glb,model/gltf-binary" onChange={pick} />
    </label>
  );

  if (state.mode === 'empty') {
    return (
      <div className="ka-cr-drop">
        <svg className="i" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 28, height: 28, color: 'var(--ink-muted)' }}>
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5" />
        </svg>
        <b>
          เลือกไฟล์ <span className="ka-cr-code">{base}_model.glb</span>
        </b>
        {picker('เลือกไฟล์ GLB')}
        <span className="ka-cr-cap">แตก ZIP ในเครื่องก่อน · เปิดในเบราว์เซอร์นี้เท่านั้น ไม่อัปโหลด</span>
      </div>
    );
  }

  if (state.mode === 'error') {
    return (
      <div className="ka-cr-glb">
        <div className="ka-cr-ban" role="alert">
          <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9l-6 6M9 9l6 6" /></svg>
          {state.cause === 'webgl' ? (
            <span>
              <b>เบราว์เซอร์นี้แสดง 3D ไม่ได้</b> (WebGL ใช้ไม่ได้) ไม่ใช่ปัญหาของไฟล์{' '}
              <span className="ka-cr-code">{state.name}</span> ลองเปิดในเบราว์เซอร์หรือเครื่องอื่น ยังไม่ต้องขอให้ลูกค้าแก้
            </span>
          ) : state.cause === 'other' ? (
            <span>
              <b>เปิดไฟล์ไม่สำเร็จ</b> <span className="ka-cr-code">{state.name}</span> ลองเลือกไฟล์อีกครั้งหรือโหลดหน้าใหม่
            </span>
          ) : (
            <span>
              <b>เปิดไฟล์นี้ไม่ได้</b> <span className="ka-cr-code">{state.name}</span> ไม่ใช่ GLB หรือไฟล์เสีย เลือกไฟล์ที่ลงท้าย{' '}
              <span className="ka-cr-code">_model.glb</span> ถ้ายังเปิดไม่ได้ให้ขอให้ลูกค้าแก้
            </span>
          )}
        </div>
        <div className="ka-cr-gfile">{picker('เลือกไฟล์อื่น')}</div>
      </div>
    );
  }

  const { name, bytes, check } = state;
  return (
    <div className="ka-cr-glb">
      {check.kind === 'other' && (
        <p className="ka-cr-warnline" role="alert">
          <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
          <span>
            <b>ชื่อไฟล์ไม่ตรงกับคำขอนี้</b> ไฟล์นี้ขึ้นต้นด้วย <span className="ka-cr-code">{check.prefix}</span> ตรวจว่าเลือกไฟล์ถูกชุด
          </span>
        </p>
      )}
      <ModelViewer
        key={name + bytes.byteLength}
        bytes={bytes}
        variant="review"
        label={label}
        onReady={() => setState((s) => (s.mode === 'loading' ? { ...s, mode: 'open' } : s))}
        onFailed={(_message, cause) => setState({ mode: 'error', name, cause })}
      />
      <div className="ka-cr-gfile">
        <span className="ka-cr-code">{name}</span>
        {state.mode === 'open' && check.kind === 'match' && (
          <span className="ka-cr-okline">
            <svg className="i i--s" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4 10-10" /></svg>
            ชื่อไฟล์ตรงกับคำขอ ฉบับ {revision}
          </span>
        )}
        {picker('เลือกไฟล์อื่น', true)}
      </div>
    </div>
  );
}
