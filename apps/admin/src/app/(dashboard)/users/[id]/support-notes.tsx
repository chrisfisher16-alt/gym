'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SupportNote } from '@/lib/queries/users';
import styles from './page.module.css';

interface Props {
  userId: string;
  initialNotes: SupportNote[];
}

export function SupportNotesSection({ userId, initialNotes }: Props) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/support-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, content: content.trim() }),
      });

      if (res.ok) {
        setContent('');
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`card card-body ${styles.notesCard}`}>
      <h3 className={styles.sectionTitle}>Support Notes</h3>

      {initialNotes.length === 0 && (
        <p className={styles.placeholder}>No support notes yet.</p>
      )}

      {initialNotes.map((note) => (
        <div key={note.id} className={styles.noteItem}>
          <div className={styles.noteMeta}>
            <span>{note.admin_email}</span>
            <span>{new Date(note.created_at).toLocaleString()}</span>
          </div>
          <p className={styles.noteContent}>{note.content}</p>
        </div>
      ))}

      <form onSubmit={handleSubmit} className={styles.noteForm}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a support note..."
          className={styles.noteInput}
          rows={3}
        />
        <button type="submit" className={styles.noteSubmit} disabled={submitting || !content.trim()}>
          {submitting ? 'Adding...' : 'Add Note'}
        </button>
      </form>
    </div>
  );
}
