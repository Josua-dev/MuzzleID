import { useState } from 'react';
import { Button, Input, Sheet, TextArea, toast } from './ui/primitives';
import { Icon } from './ui/Icon';
import { contactOwner } from '../services/actions';
import type { Animal, User } from '../types/models';

/** Privacy-preserving contact: the message is relayed via MuzzleID; the owner's phone number is not shown. */
export function ContactOwnerSheet({ open, onClose, animal, user }: { open: boolean; onClose: () => void; animal: Animal; user: User }) {
  const alert = animal.status === 'STOLEN' || animal.status === 'MISSING';
  const [msg, setMsg] = useState(alert ? `I have scanned an animal matching ${animal.muzzle_id}. Please contact me.` : `Query about ${animal.muzzle_id}.`);
  const [phone, setPhone] = useState(user.phone);
  return (
    <Sheet open={open} onClose={onClose} title="Contact owner">
      <div className="mb-4 flex gap-3 rounded-2xl bg-forest-50 p-3 text-sm text-forest-900">
        <Icon name="lock" size={18} className="mt-0.5 shrink-0" />
        <p>Your message is delivered through MuzzleID. The owner's phone number stays private; they can call you back.</p>
      </div>
      <div className="space-y-3">
        <TextArea label="Message" value={msg} onChange={(e) => setMsg(e.target.value)} />
        <Input label="Your call-back number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Button full icon="message" disabled={!msg.trim()} onClick={() => { contactOwner(user, animal.id, msg.trim(), phone); toast('Message sent to owner'); onClose(); }}>Send message</Button>
        <p className="text-center text-xs text-charcoal-500">In-app relay only. No automatic police or authority notification is made.</p>
      </div>
    </Sheet>
  );
}
