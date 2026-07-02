import { useState } from 'react';
import { faviconUrl, senderInitial } from '../lib/mail';

interface Props {
  name: string;
  email: string;
}

export default function Avatar({ name, email }: Props) {
  const [failed, setFailed] = useState(false);
  const src = faviconUrl(email);

  if (!src || failed) {
    return <span className="avatar avatar-letter">{senderInitial(name)}</span>;
  }
  return <img className="avatar" src={src} alt="" onError={() => setFailed(true)} />;
}
