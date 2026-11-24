import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { Phon } from '@/components/Phon';
import { ExerciseView } from '@/components/ExerciseView';
import { PronunciationCard } from '@/components/PronunciationCard';
import { AppProvider } from '@/state/AppContext';
import { getItem } from '@/lib/items';
import type { Exercise } from '@/content/schema';

const wrap = (ui: React.ReactNode) => render(<AppProvider><MemoryRouter>{ui}</MemoryRouter></AppProvider>);

describe('Phon', () => {
  it('wyróżnia sylabę akcentowaną', () => {
    const { container } = render(<Phon text="o-bri-GA-du" />);
    expect(container.querySelector('.stress')?.textContent).toBe('GA');
  });
  it('ciemne ɫ nie psuje wykrywania akcentu', () => {
    const { container } = render(<Phon text="pur-tu-GAɫ" />);
    expect(container.querySelector('.stress')?.textContent).toBe('GAl');
    expect(container.querySelector('.dark-l')).toHaveAttribute('title', expect.stringMatching(/NIE jest polskie ł/));
  });
});

describe('PronunciationCard', () => {
  it('pokazuje 4 warstwy: PT, PL, wymowę i przycisk audio + status weryfikacji', async () => {
    wrap(<PronunciationCard item={getItem('obrigado')} />);
    expect(await screen.findByText('obrigado')).toBeInTheDocument();
    expect(screen.getByText('dziękuję')).toBeInTheDocument();
    expect(screen.getByLabelText('wymowa: o-bri-GA-du')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Odsłuchaj: obrigado/ })).toBeInTheDocument();
    expect(screen.getByText('wymowa niezweryfikowana')).toBeInTheDocument();
  });
});

describe('ExerciseView', () => {
  it('luka: błędna odpowiedź pokazuje wyjaśnienie i kategorię błędu', async () => {
    const ex = { id: 't1', type: 'fillGap', sentencePt: 'Eu ___ cansado.', sentencePl: 'Jestem zmęczony.', options: ['estou', 'sou'], answer: 'estou', mistakeCategory: 'ser-estar', wrongExplanations: { sou: 'Zmęczenie mija → estou.' } } as Exercise;
    const onAnswered = vi.fn();
    wrap(<ExerciseView exercise={ex} onAnswered={onAnswered} onNext={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'sou' }));
    expect(onAnswered).toHaveBeenCalledWith(expect.objectContaining({ correct: false, category: 'ser-estar', skill: 'building' }));
    expect(screen.getByText('Zmęczenie mija → estou.')).toBeInTheDocument();
  });
  it('układanie zdania z kafelków', async () => {
    const ex = { id: 't2', type: 'buildSentence', targetItemId: 'nao-falo-bem', tiles: ['Não', 'falo', 'bem', 'português'] } as Exercise;
    const onAnswered = vi.fn();
    wrap(<ExerciseView exercise={ex} onAnswered={onAnswered} onNext={() => {}} />);
    for (const w of ['Não', 'falo', 'bem', 'português']) await userEvent.click(await screen.findByRole('button', { name: w }));
    await userEvent.click(screen.getByRole('button', { name: 'Sprawdź' }));
    expect(onAnswered).toHaveBeenCalledWith(expect.objectContaining({ correct: true }));
  });
});
