import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Setup from './Setup';

describe('Setup component', () => {
  it('renders the setup form', () => {
        render(
            <MemoryRouter>
                <Setup onStartMatch={() => {}} />
            </MemoryRouter>
        );
        expect(screen.getByText('Create Match')).toBeInTheDocument();
    expect(screen.getByLabelText('Match Name:')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /player 1/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /player 2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start match/i })).toBeInTheDocument();
  });
});