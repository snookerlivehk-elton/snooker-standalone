import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

describe('App component integration', () => {
  it('should transition from Setup to Scoreboard on match start', async () => {
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        exists: { P1: true, P2: true },
        names: { P1: 'Player 1 Name', P2: 'Player 2 Name' },
      }),
    } as any);

    render(
        <MemoryRouter initialEntries={['/room/test-room/setup']}>
            <App />
        </MemoryRouter>
    );

    // App should start by rendering the Setup component
    expect(screen.getByText('Create Match')).toBeInTheDocument();

    // Fill in the form
    fireEvent.change(screen.getByLabelText('Match Name:'), { target: { value: 'Test Match' } });
    const fullNameInputs = screen.getAllByLabelText(/full name/i);
    fireEvent.change(fullNameInputs[0], { target: { value: 'Player 1 Name' } });
    fireEvent.change(fullNameInputs[1], { target: { value: 'Player 2 Name' } });
    const memberIdInputs = screen.getAllByLabelText(/member id/i);
    fireEvent.change(memberIdInputs[0], { target: { value: 'P1' } });
    fireEvent.change(memberIdInputs[1], { target: { value: 'P2' } });
    fireEvent.change(screen.getByLabelText(/number of frames/i), { target: { value: '5' } });

    // Select starting player
    fireEvent.click(screen.getByRole('button', { name: /player 2/i }));

    // Click the start button
    fireEvent.click(screen.getByRole('button', { name: /start match/i }));

    // After starting the match, the Scoreboard component should be rendered
    await screen.findByText('Test Match');
    expect(screen.queryByText('Create Match')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch player/i })).toBeInTheDocument();

    globalThis.fetch = originalFetch;
  });
});
