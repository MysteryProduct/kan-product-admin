import Link from 'next/link';

const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);

const today = () =>
  new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(new Date());

interface GreetingPanelProps {
  name: string;
  /** Jobs waiting for this employee; undefined while the summary has not arrived or none is visible. */
  waiting?: number;
  urgent?: number;
  /** Shortcuts, each shown only when the employee may add that document. */
  links: { href: string; label: string; primary?: boolean }[];
}

/** The one decorative surface of the admin: charcoal with the logo's diagonal cuts. It stays off data screens. */
export default function GreetingPanel({ name, waiting, urgent, links }: GreetingPanelProps) {
  return (
    <section className="ka-hello" aria-label="ทักทาย">
      <div className="ka-hello__text">
        <p className="ka-hello__date">{today()}</p>
        <h1 className="ka-hello__title">สวัสดี {name}</h1>
        {waiting !== undefined && (
          <p className="ka-hello__sub numeric">
            {waiting === 0 ? 'ไม่มีงานค้างที่รอคุณ' : `มีงานรอคุณ ${count(waiting)} รายการ`}
            {urgent ? ` · ด่วน ${count(urgent)} รายการ` : ''}
          </p>
        )}
      </div>
      {links.length > 0 && (
        <div className="ka-hello__actions">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={`ka-btn ${link.primary ? 'ka-btn--primary' : ''}`}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
