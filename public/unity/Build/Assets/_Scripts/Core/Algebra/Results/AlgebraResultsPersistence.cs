using System;

public static class AlgebraResultsPersistence
{
	[Serializable]
	public sealed class PersonalBestData
	{
		public int bestScore;
		public string updatedAtUtc;
		public string levelDisplayName;
	}

	public readonly struct SaveBestResult
	{
		public readonly int previousBestScore;
		public readonly int bestScore;
		public readonly bool isNewBest;

		public SaveBestResult(int previousBestScore, int bestScore, bool isNewBest)
		{
			this.previousBestScore = previousBestScore;
			this.bestScore = bestScore;
			this.isNewBest = isNewBest;
		}
	}

	private static string BuildKey(string sceneKey) => $"algebra/results/pb/{sceneKey}";

	public static PersonalBestData LoadPersonalBest(string sceneKey)
	{
		string key = BuildKey(sceneKey);
		if (!ES3.KeyExists(key))
			return null;

		try
		{
			return ES3.Load<PersonalBestData>(key);
		}
		catch
		{
			return null;
		}
	}

	public static SaveBestResult SaveIfBest(string sceneKey, AlgebraResultsSnapshot snapshot)
	{
		if (snapshot == null)
			return new SaveBestResult(0, 0, false);

		PersonalBestData existing = LoadPersonalBest(sceneKey);
		int previousBest = existing != null ? existing.bestScore : 0;
		bool isNewBest = existing == null || snapshot.score > previousBest;
		int finalBest = previousBest;

		if (isNewBest)
		{
			finalBest = snapshot.score;
			PersonalBestData payload = existing ?? new PersonalBestData();
			payload.bestScore = snapshot.score;
			payload.updatedAtUtc = DateTime.UtcNow.ToString("O");
			payload.levelDisplayName = snapshot.levelDisplayName;
			ES3.Save(BuildKey(sceneKey), payload);
		}
		else if (existing != null)
		{
			finalBest = existing.bestScore;
		}

		return new SaveBestResult(previousBest, finalBest, isNewBest);
	}
}
