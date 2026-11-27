import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useApp } from '../app/app-state';
import { Icon } from './Icon';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'prefix'> & { label: ReactNode; hint?: ReactNode; adornment?: ReactNode };

export function Field({ label, hint, adornment, ...input }: InputProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="in">
        {adornment}
        <input id={id} {...input} />
      </div>
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function PasswordField({ label, hint, adornment: _a, ...input }: InputProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const { t } = useApp();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="in">
        <input id={id} type={shown ? 'text' : 'password'} {...input} />
        <button type="button" className="eye" aria-label={shown ? t.hidePw : t.showPw} aria-pressed={shown} onClick={() => setShown((s) => !s)}>
          <Icon name={shown ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </div>
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function FormError({ msg }: { msg: string }) {
  return <p className="err" role="alert" aria-live="assertive">{msg}</p>;
}
