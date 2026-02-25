import { Game } from '@/types'

/**
 * Determine if a game's season has ended (all rounds played, no more upcoming).
 *
 * A season is considered ended when:
 * - total_rounds is known (> 0)
 * - current_round has reached or passed total_rounds
 * - round_state indicates the round is finished ('Ended' or 'EndedLastest')
 */
export function isGameSeasonEnded(game: Game): boolean {
  if (!game.total_rounds || game.total_rounds <= 0) return false
  if (game.current_round < game.total_rounds) return false

  const endedStates = ['Ended', 'EndedLastest']
  return endedStates.includes(game.round_state || '')
}
