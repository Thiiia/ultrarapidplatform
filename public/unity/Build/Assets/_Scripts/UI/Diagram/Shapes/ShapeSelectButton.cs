using System.Collections;
using UnityEngine.UI;
using TMPro;
using UnityEngine.SceneManagement;
using DG.Tweening;
using UnityEngine;

public class ShapeSelectButton : MonoBehaviour
{
	enum Difficulty
	{
		Easy,
		Medium,
		Hard
	}

	public enum ShapeType
	{
		Empty,
		Square,
		Triangle,
		Hexagon,
		Star,
		Circle,
		Complex
	}

	[SerializeField] private GameObject shapeLibrary;
	[SerializeField] private string sceneToLoad = "WispPerimeterAnimesh";
	[SerializeField] private Transform perimeterShapeParent;
	[SerializeField] private GameObject shapePrefab;
	[SerializeField] private GameObject currentShapeInstance;
	[SerializeField] private ShapeType shapeType;
	[SerializeField] private GameObject shapeIcon;
	[SerializeField] private Button selectButton;
	[SerializeField] private TextMeshProUGUI shapeNameText;
	[SerializeField] private TextMeshProUGUI beatsNumberText;
	[SerializeField] private Difficulty difficultyLevel;
	[SerializeField] private Image[] difficultyStars;
	[SerializeField] private float beats = 1f;

	[SerializeField] private Sprite emptyIconSprite;
	[SerializeField] private Sprite starIconSprite;

	[Header("Pop Ups")]
	[SerializeField] private Image missionStartingPopup;
	[SerializeField] private TextMeshProUGUI missionCountdownText;

	private bool hasSelected = false;

	private void Awake()
	{
		SetShape();
	}

	private void OnValidate()
	{
		SetShape();
	}
	private void OnEnable()
	{
		GameplayEventBus.OnPerimeterShapeChanged += UpdateCurrentShapeInstance;
	}

	private void OnDisable()
	{
		GameplayEventBus.OnPerimeterShapeChanged -= UpdateCurrentShapeInstance;
	}

	private void SetShape()
	{
		if (shapeNameText)
		{
			shapeNameText.text = shapeType.ToString();
		}

		if (beatsNumberText)
		{
			beatsNumberText.text = beats.ToString("0.##") + " Beats";
		}

		for (int i = 0; i < difficultyStars.Length; ++i)
		{
			if (i <= (int)difficultyLevel)
			{
				difficultyStars[i].sprite = starIconSprite;
			}
			else
			{
				difficultyStars[i].sprite = emptyIconSprite;
			}
		}
	}

	public void SetPerimeterShape()
	{
		if (shapePrefab && perimeterShapeParent)
		{
			currentShapeInstance = Instantiate(shapePrefab, perimeterShapeParent);

			if (!currentShapeInstance)
			{
				Debug.LogError("Failed to instantiate shape prefab.");
				return;
			}

			currentShapeInstance.transform.localPosition = Vector3.zero;
			currentShapeInstance.transform.localRotation = Quaternion.identity;

			GameplayEventBus.RaisePerimeterShapeChanged(currentShapeInstance);
		}
	}

	private void UpdateCurrentShapeInstance(GameObject perimeterInstance)
	{
		if (currentShapeInstance)
		{
			currentShapeInstance = perimeterInstance;
		}
	}

	public void OnShapeSelectedInLevelSelect()
	{
		if (hasSelected)
		{
			return;
		}
		hasSelected = true;

		// WebGL: ensure the browser audio context is unlocked from this click.
		AudioManager.UnlockFromUserGesture(false);

		GameplayEventBus.currentShape = shapeType;

		if (shapeLibrary)
		{
			shapeLibrary.transform.DOScale(0.0f, 0.5f).From(1.0f).SetEase(Ease.OutBack);
		}

		if (missionStartingPopup)
		{
			missionStartingPopup.transform.localScale = Vector3.zero;
			missionStartingPopup.gameObject.SetActive(true);
			missionStartingPopup.transform.DOScale(1f, 0.5f).From(0f).SetEase(Ease.OutBack);
			StartCoroutine(MissionCountdownCoroutine());
		}
	}

	private IEnumerator MissionCountdownCoroutine()
	{
		int countdown = 3;
		yield return new WaitForSecondsRealtime(0.5f);

		while (countdown > 0)
		{
			missionCountdownText.text = countdown.ToString();
			countdown--;
			yield return new WaitForSecondsRealtime(1f);
		}

		missionCountdownText.text = "Go!";
		yield return new WaitForSecondsRealtime(0.5f);
		missionStartingPopup.transform.DOScale(0f, 0.5f).From(1.0f).SetEase(Ease.OutBack);

		SceneManager.LoadScene(sceneToLoad);
		// Trigger tutorial on first shape selection if not seen.
		TutorialManager.RequestTutorialIfNotSeen();
	}
}
