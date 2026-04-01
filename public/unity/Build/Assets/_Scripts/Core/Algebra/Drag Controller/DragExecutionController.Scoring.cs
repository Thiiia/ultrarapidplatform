using UnityEngine;
using Sirenix.OdinInspector;

using TMPro;

using DG.Tweening;

public partial class DragExecutionController
{
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), SerializeField] private bool enableBasicScoring = true;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoringSettings)), SerializeField] private TextMeshProUGUI scoreHudText;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoringSettings)), SerializeField] private TextMeshProUGUI accuracyHudText;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoringSettings)), SerializeField] private TextMeshProUGUI streakHudText;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoringSettings)), SerializeField, Min(0f)] private float perfectPoints = 1f;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoringSettings)), SerializeField, Min(0f)] private float goodPoints = 0.75f;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoringSettings)), SerializeField, Min(0f)] private float missPoints = 0f;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoringSettings)), SerializeField] private bool scoreHudPolish = true;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoreHudPolishSettings)), SerializeField, Min(0.01f)] private float scoreHudTweenSeconds = 0.12f;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoreHudPolishSettings)), SerializeField, Range(1f, 1.6f)] private float scoreHudPunchScale = 1.12f;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoreHudPolishSettings)), SerializeField] private Color scoreHudPerfectColor = AlgebraUiPalette.JudgementGreen;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoreHudPolishSettings)), SerializeField] private Color scoreHudGoodColor = AlgebraUiPalette.JudgementYellow;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoreHudPolishSettings)), SerializeField] private Color scoreHudMissColor = AlgebraUiPalette.JudgementRed;
	private int lastDisplayedScore = int.MinValue;
	private int lastDisplayedAccuracy = int.MinValue;
	private int lastDisplayedStreak = int.MinValue;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoringSettings)), SerializeField] private bool scoreHudCountUp = true;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoreHudCountUpSettings)), SerializeField, Min(0.01f)] private float scoreHudCountUpSeconds = 0.18f;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoringSettings)), SerializeField] private bool scoreHudHeatByStreak = true;
	[FoldoutGroup("HUD"), FoldoutGroup("HUD/Scoring"), ShowIf(nameof(ShowScoreHudHeatSettings)), SerializeField, Min(1)] private int scoreHudHeatMaxStreak = 24;
	private Tween scoreHudCountTween;
	private Tween accuracyHudCountTween;
	private Tween streakHudCountTween;
	private int scoreTotalHits;
	private int scorePerfectHits;
	private int scoreGoodHits;
	private int scoreMissHits;
	private int scoreStreak;
	private int scoreMaxStreak;
	private float scorePoints;
	private bool ShowScoringSettings => enableBasicScoring;
	private bool ShowScoreHudPolishSettings => enableBasicScoring && scoreHudPolish;
	private bool ShowScoreHudCountUpSettings => enableBasicScoring && scoreHudCountUp;
	private bool ShowScoreHudHeatSettings => enableBasicScoring && scoreHudHeatByStreak;

	private void RegisterBasicScore(HitResult result, float points01)
	{
		if (!enableBasicScoring)
		{
			return;
		}

		scoreTotalHits++;
		switch (result)
		{
			case HitResult.Perfect:
				scorePerfectHits++;
				scoreStreak++;
				scorePoints += Mathf.Max(0f, perfectPoints * points01);
				break;
			case HitResult.Good:
				scoreGoodHits++;
				scoreStreak++;
				scorePoints += Mathf.Max(0f, goodPoints * points01);
				break;
			default:
				scoreMissHits++;
				scoreStreak = 0;
				scorePoints += Mathf.Max(0f, missPoints * points01);
				break;
		}

		if (scoreStreak > scoreMaxStreak)
		{
			scoreMaxStreak = scoreStreak;
		}

		UpdateBasicScoreHud();
		ApplyScoreHudPolish(result);
	}

	public AlgebraScoreSnapshot GetScoreSnapshot()
	{
		int score = Mathf.RoundToInt(scorePoints * 100f);
		float maxPoints = Mathf.Max(1f, scoreTotalHits * perfectPoints);
		int accuracy = Mathf.RoundToInt(Mathf.Clamp01(scorePoints / maxPoints) * 100f);

		return new AlgebraScoreSnapshot
		{
			score = score,
			accuracyPercent = accuracy,
			totalAttempts = scoreTotalHits,
			currentStreak = scoreStreak,
			maxCombo = scoreMaxStreak,
			perfectCount = scorePerfectHits,
			goodCount = scoreGoodHits,
			missCount = scoreMissHits,
			perfectPoints = perfectPoints,
			goodPoints = goodPoints,
			missPoints = missPoints
		};
	}

	private void UpdateBasicScoreHud()
	{
		if (!enableBasicScoring)
		{
			return;
		}

		float heat01 = (scoreHudHeatByStreak && scoreHudHeatMaxStreak > 0)
			? Mathf.Clamp01(scoreStreak / (float)scoreHudHeatMaxStreak)
			: 0f;

		if (scoreHudText != null)
		{
			int score = Mathf.RoundToInt(scorePoints * 100f);
			if (scoreHudCountUp)
			{
				int from = lastDisplayedScore == int.MinValue ? score : lastDisplayedScore;
				scoreHudCountTween?.Kill();
				scoreHudCountTween = DOVirtual.Float(from, score, scoreHudCountUpSeconds, v =>
				{
					if (scoreHudText != null)
					{
						scoreHudText.text = Mathf.RoundToInt(v).ToString();
					}
				}).SetEase(Ease.OutQuad).SetUpdate(true);
			}
			else
			{
				scoreHudText.text = score.ToString();
			}
			lastDisplayedScore = score;

			if (scoreHudHeatByStreak)
			{
				scoreHudText.characterSpacing = Mathf.Lerp(0f, 3f, heat01);
			}
		}

		if (accuracyHudText != null)
		{
			float maxPoints = Mathf.Max(1f, scoreTotalHits * perfectPoints);
			float acc01 = Mathf.Clamp01(scorePoints / maxPoints);
			int acc = Mathf.RoundToInt(acc01 * 100f);
			if (scoreHudCountUp)
			{
				int from = lastDisplayedAccuracy == int.MinValue ? acc : lastDisplayedAccuracy;
				accuracyHudCountTween?.Kill();
				accuracyHudCountTween = DOVirtual.Float(from, acc, scoreHudCountUpSeconds, v =>
				{
					if (accuracyHudText != null)
					{
						accuracyHudText.text = $"{Mathf.RoundToInt(v)}%";
					}
				}).SetEase(Ease.OutQuad).SetUpdate(true);
			}
			else
			{
				accuracyHudText.text = $"{acc}%";
			}
			lastDisplayedAccuracy = acc;
		}

		if (streakHudText != null)
		{
			if (scoreHudCountUp)
			{
				int to = scoreStreak;
				int from = lastDisplayedStreak == int.MinValue ? to : lastDisplayedStreak;
				streakHudCountTween?.Kill();
				streakHudCountTween = DOVirtual.Float(from, to, scoreHudCountUpSeconds, v =>
				{
					if (streakHudText != null)
					{
						int s = Mathf.RoundToInt(v);
						streakHudText.text = s > 0 ? $"x{s}" : string.Empty;
					}
				}).SetEase(Ease.OutQuad).SetUpdate(true);
			}
			else
			{
				streakHudText.text = scoreStreak > 0 ? $"x{scoreStreak}" : string.Empty;
			}
			lastDisplayedStreak = scoreStreak;

			if (scoreHudHeatByStreak)
			{
				Color baseCol = Color.Lerp(Color.white, new Color(1f, 0.95f, 0.45f, 1f), heat01);
				streakHudText.color = baseCol;
			}
		}
	}

	private void ApplyScoreHudPolish(HitResult result)
	{
		if (!scoreHudPolish)
		{
			return;
		}

		Color c = result switch
		{
			HitResult.Perfect => scoreHudPerfectColor,
			HitResult.Good => scoreHudGoodColor,
			_ => scoreHudMissColor,
		};

		void Punch(TextMeshProUGUI tmp)
		{
			if (tmp == null)
			{
				return;
			}

			tmp.DOKill();
			tmp.transform.DOKill();

			tmp.color = c;
			tmp.transform.localScale = Vector3.one;
			tmp.transform.DOScale(scoreHudPunchScale, scoreHudTweenSeconds)
				.SetEase(Ease.OutBack)
				.OnComplete(() =>
				{
					if (tmp != null)
					{
						tmp.transform.DOScale(1f, scoreHudTweenSeconds).SetEase(Ease.OutQuad);
						tmp.DOColor(Color.white, Mathf.Max(0.05f, scoreHudTweenSeconds * 2f)).SetEase(Ease.OutQuad);
					}
				});
		}

		Punch(scoreHudText);
		Punch(accuracyHudText);
		Punch(streakHudText);
	}
}
