import React from 'react';
import TournamentPosterLightbox from '../../components/TournamentPosterLightbox';

type ClubPublicTournamentPosterLightboxProps = {
  open: boolean;
  imageUrl: string;
  title: string;
  onClose: () => void;
};

const ClubPublicTournamentPosterLightbox: React.FC<ClubPublicTournamentPosterLightboxProps> = ({
  open,
  imageUrl,
  title,
  onClose,
}) => (
  <TournamentPosterLightbox
    open={open}
    posters={imageUrl ? [{ imageUrl, title }] : []}
    onClose={onClose}
  />
);

export default ClubPublicTournamentPosterLightbox;
