# Copy Quality Gate

Marco 6 adds a deterministic editorial quality gate to approved post details.
It checks copy before the final package is closed or exported.

Included:

- package-level copy review in `/approved/[postId]`;
- review of visual headline, support copy, visual CTA, caption, first comment,
  hashtags, and carousel slides;
- blockers for Portuguese issues, briefing language, weak public copy, AI-like
  formulations, forbidden brand terms, engagement bait, overpromises, and text
  that is too long for its field;
- warnings for missing interaction cue, weak specificity, no hashtags, generic
  hashtags, short captions, and repeated visual/caption copy;
- safe auto-fix button for accents, spacing, repeated punctuation, and dashes;
- direct editing for the selected caption and first comment in the approved
  post detail page;
- deterministic first-comment suggestion when the gate blocks weak or mechanical
  comment copy;
- package finalization blocked while blocker issues remain;
- carousel approval still blocked when slide copy has blocker issues.

Not included yet:

- LLM-based adversarial rewrite;
- grammar correction beyond the explicit Portuguese replacement list;
- automatic rewrite for strategic or tonal problems;
- analytics-driven scoring;
- Zernio publishing rules.

## Safe Auto-Fix

`Corrigir copy` only applies deterministic corrections that do not need a model:

- common missing accents such as `voce` -> `você`;
- common spelling fixes such as `nao` -> `não`;
- duplicated spaces;
- repeated punctuation;
- em dash / en dash replacement.

If the issue is strategic, such as generic phrasing, briefing language, weak CTA,
or exaggerated promise, the user must edit the copy manually or regenerate the
content.

When safe fixes change any copy, the final package returns to open review and an
approved carousel returns to draft review.

## Validation

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Manual validation:

1. Open an approved post detail page.
2. Confirm `Quality Gate de Copy` appears after the final package section.
3. Confirm clean copy shows `OK`.
4. Introduce a copy issue such as `Nao e robo — transforme sua jornada`.
5. Confirm the panel shows `Revisar`.
6. Confirm `Finalizar pacote` is blocked while blocker issues remain.
7. Click `Corrigir copy`.
8. Confirm safe corrections are applied and the package returns to open review.
9. Confirm issues that cannot be safely fixed remain visible.
10. Generate a carousel and confirm slide issues appear in the same gate.
11. If `Primeiro comentário` is blocked, confirm the gate shows a suggested
    replacement and `Aplicar sugestão` updates the comment.
12. Confirm the lower `Primeiro comentário` card can be edited and saved
    manually.
