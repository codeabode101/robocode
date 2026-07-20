'use client';

import { useState } from 'react';
import { CHARACTERS, saveCharacterId, getSavedCharacterId } from './game/characters';

interface Props {
  onConfirm: (characterId: string) => void;
}

const genderColors: Record<string, string> = {
  male: '#3b82f6',
  female: '#ec4899',
};

const MALE_EMOJIS = ['👨‍🌾', '👨‍🔧', '🧑'];
const FEMALE_EMOJIS = ['👩', '👩‍🔧', '🧝‍♀️'];

export default function CharacterSelect({ onConfirm }: Props) {
  const [selected, setSelected] = useState<string>(getSavedCharacterId() || 'm_farmer');
  const [entering, setEntering] = useState(false);

  const handleConfirm = () => {
    if (!selected) return;
    setEntering(true);
    saveCharacterId(selected);
    setTimeout(() => onConfirm(selected), 400);
  };

  const males = CHARACTERS.filter(c => c.gender === 'male');
  const females = CHARACTERS.filter(c => c.gender === 'female');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      fontFamily: 'system-ui, sans-serif',
      opacity: entering ? 0 : 1,
      transition: 'opacity 0.4s ease',
    }}>
      <h1 style={{
        color: '#fbbf24', fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem',
        textShadow: '0 2px 8px rgba(0,0,0,0.5)',
      }}>
        Choose Your Character
      </h1>
      <p style={{ color: '#94a3b8', marginBottom: '2rem', fontSize: '0.95rem' }}>
        Pick a character to explore Robocode
      </p>

      <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* Male row */}
        <div>
          <h3 style={{ color: '#93c5fd', textAlign: 'center', marginBottom: '0.75rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Male
          </h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {males.map((c, i) => (
              <CharacterCard
                key={c.id}
                character={c}
                emoji={MALE_EMOJIS[i] || '🧑'}
                color={genderColors.male}
                selected={selected === c.id}
                onClick={() => setSelected(c.id)}
              />
            ))}
          </div>
        </div>

        {/* Female row */}
        <div>
          <h3 style={{ color: '#f9a8d4', textAlign: 'center', marginBottom: '0.75rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Female
          </h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {females.map((c, i) => (
              <CharacterCard
                key={c.id}
                character={c}
                emoji={FEMALE_EMOJIS[i] || '👩'}
                color={genderColors.female}
                selected={selected === c.id}
                onClick={() => setSelected(c.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleConfirm}
        disabled={!selected}
        style={{
          marginTop: '2.5rem',
          padding: '0.75rem 2.5rem',
          fontSize: '1.1rem',
          fontWeight: 600,
          border: 'none',
          borderRadius: '0.5rem',
          cursor: selected ? 'pointer' : 'not-allowed',
          opacity: selected ? 1 : 0.4,
          background: selected ? 'linear-gradient(135deg, #f59e0b, #f97316)' : '#334155',
          color: selected ? '#1e293b' : '#64748b',
          transition: 'all 0.2s',
          transform: selected ? 'scale(1)' : 'scale(0.95)',
        }}
      >
        {selected ? 'Enter Robocode' : 'Select a character'}
      </button>
    </div>
  );
}

function CharacterCard({
  character, emoji, color, selected, onClick,
}: {
  character: { id: string; name: string };
  emoji: string;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width: '7rem', height: '10rem',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '0.5rem',
        borderRadius: '0.75rem',
        cursor: 'pointer',
        background: selected
          ? `linear-gradient(135deg, ${color}33, ${color}55)`
          : 'rgba(255,255,255,0.04)',
        border: selected ? `2px solid ${color}` : '2px solid rgba(255,255,255,0.08)',
        transition: 'all 0.2s',
        transform: selected ? 'scale(1.05)' : 'scale(1)',
        boxShadow: selected ? `0 0 20px ${color}44` : 'none',
      }}
    >
      <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>{emoji}</div>
      <span style={{ color: selected ? '#f8fafc' : '#94a3b8', fontSize: '0.85rem', fontWeight: 500 }}>
        {character.name}
      </span>
    </div>
  );
}
