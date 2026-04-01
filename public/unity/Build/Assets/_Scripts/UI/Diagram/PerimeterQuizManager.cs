using UnityEngine;
using UnityEngine.UI;
using TMPro;
using DG.Tweening;
using UnityEngine.SceneManagement;
using System.Collections;

public class PerimeterQuizManager : MonoBehaviour
{
	[Header("UI Elements")]
	public TMP_InputField answerInput;
	public GameObject questionImage;
	public GameObject correctResultImage;
	public GameObject incorrectResultImage;
	[SerializeField] private Image hintImage;
	[SerializeField] private GameObject thankYouPopup;

	[Header("Scene Names")]
	public string retrySceneName = "MVP_Perimeter";
	public string exitSceneName = "StartScene";

	[Header("Answer Settings")]
	public float correctAnswer = 48.1f;
	public float tolerance = 0.1f;

	private bool isTransitioning = false;

	void Start()
	{
		questionImage.SetActive(true);
		correctResultImage.SetActive(false);
		incorrectResultImage.SetActive(false);

		if (ScoreManagerScript.Instance != null && ScoreManagerScript.Instance.TryConsumePerimeterQuiz(out var payload))
		{
			if (payload.totalDistance > 0f)
				correctAnswer = payload.totalDistance;

			if (payload.tolerance > 0f)
				tolerance = payload.tolerance;
		}
	}

	public void CheckAnswer()
	{
		if (float.TryParse(answerInput.text, out float playerAnswer))
		{
			bool isCorrect = Mathf.Abs(playerAnswer - correctAnswer) <= tolerance;

			questionImage.SetActive(false);
			if (isCorrect)
			{
				correctResultImage.SetActive(true);
			}
			else
			{
				incorrectResultImage.SetActive(true);
			}
		}
		else
		{
			Debug.LogWarning("Invalid input: must be a number");
		}
	}

	public void ToggleShowHint()
	{
		if (hintImage)
		{
			if (hintImage.gameObject.activeSelf)
			{
				hintImage.gameObject.transform.DOScale(0.0f, 0.3f);
				hintImage.gameObject.SetActive(false);
			}
			else
			{
				hintImage.gameObject.SetActive(true);
				hintImage.gameObject.transform.DOScale(1.1f, 0.3f);
			}
		}
	}

	public void PopUpThankYou(bool tryAgain)
	{
		if (thankYouPopup)
		{
			thankYouPopup.transform.localScale = Vector3.zero;
			thankYouPopup.SetActive(true);
			thankYouPopup.transform.DOScale(1.0f, 0.5f).From(0.0f).SetEase(Ease.OutBack);
		}

		if (isTransitioning)
		{
			return;
		}
		isTransitioning = true;

		if (!tryAgain)
		{
			StartCoroutine(Exit());
		}
		else
		{
			StartCoroutine(TryAgain());
		}
	}

	public void RetryQuiz()
	{
		if (questionImage != null)
		{
			questionImage.SetActive(true);
		}

		if (correctResultImage != null)
		{
			correctResultImage.SetActive(false);
		}

		if (incorrectResultImage != null)
		{
			incorrectResultImage.SetActive(false);
		}
	}

	public void StartExiting()
	{
		StartCoroutine(Exit());
	}

	private IEnumerator TryAgain()
	{
		yield return new WaitForSecondsRealtime(3.0f);
		if (ScoreManagerScript.Instance != null)
		{
			ScoreManagerScript.Instance.ResetScore();
		}
		SceneManager.LoadScene(retrySceneName);
	}

	private IEnumerator Exit()
	{
		yield return new WaitForSecondsRealtime(3.0f);
		SceneManager.LoadScene(exitSceneName);
	}
}
