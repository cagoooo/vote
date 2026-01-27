import useSound from 'use-sound';

// Sound URLs - Using simpler encoded sounds
const VOTE_SUBMITTED = `${import.meta.env.BASE_URL}sounds/vote-submitted.mp3`;
const VOTE_SESSION_START = `${import.meta.env.BASE_URL}sounds/vote-start.mp3`;

export function useVotingSound() {
  // Sound for when a vote is submitted
  const [playVoteSubmitted] = useSound(VOTE_SUBMITTED, {
    volume: 0.5
  });

  // Sound for when a new voting session starts
  const [playVoteSessionStart] = useSound(VOTE_SESSION_START, {
    volume: 0.5
  });

  return {
    playVoteSubmitted,
    playVoteSessionStart
  };
}