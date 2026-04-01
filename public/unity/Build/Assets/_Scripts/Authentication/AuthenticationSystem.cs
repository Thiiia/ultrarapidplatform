using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using DG.Tweening;
using TMPro;
using Unity.Services.Authentication;
using Unity.Services.Authentication.PlayerAccounts;
using Unity.Services.Core;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

public class AuthenticationSystem : MonoBehaviour
{
	private const string UnityIdentityProviderId = "unity";
	private const string UsernamePattern = @"^[A-Za-z0-9._@-]{3,20}$";

	private static readonly Color32 ShellBackdropColor = new Color32(3, 5, 10, 220);
	private static readonly Color32 ShellPanelColor = new Color32(10, 15, 30, 242);
	private static readonly Color32 ShellModuleColor = new Color32(19, 27, 49, 214);
	private static readonly Color32 ShellBorderColor = new Color32(216, 255, 47, 52);
	private static readonly Color32 ShellBorderStrongColor = new Color32(216, 255, 47, 112);
	private static readonly Color32 ShellAccentColor = new Color32(216, 255, 47, 255);
	private static readonly Color32 ShellAccentSoftColor = new Color32(122, 248, 213, 255);
	private static readonly Color32 ShellTextColor = new Color32(244, 247, 255, 255);
	private static readonly Color32 ShellMutedTextColor = new Color32(189, 198, 218, 255);
	private static readonly Color32 ShellFaintTextColor = new Color32(126, 138, 162, 255);
	private static readonly Color32 ShellDangerColor = new Color32(255, 109, 109, 255);
	private static readonly Color32 ShellPrimaryTextColor = new Color32(8, 16, 9, 255);
	private static readonly Color32 ShellInputColor = new Color32(12, 18, 34, 225);
	private static readonly Color32 ShellInfoPanelColor = new Color32(13, 33, 43, 210);
	private static readonly Color32 ShellErrorPanelColor = new Color32(55, 18, 24, 224);
	private static readonly Color32 ShellGlassPanelColor = new Color32(18, 28, 50, 208);
	private static readonly Color32 ShellGlowCyanColor = new Color32(122, 248, 213, 64);
	private static readonly Color32 ShellGlowLimeColor = new Color32(216, 255, 47, 42);

	private enum AuthButtonStyle
	{
		Primary,
		Secondary,
		Ghost,
	}

	[SerializeField] private bool signInAnonymouslyOnStartup = true;
	[SerializeField] private bool allowLegacyLocalCodeBypassInEditor = false;
	[SerializeField] private TMP_InputField codeText;
	[SerializeField] private string legacyLocalAccessCode = "RAPID-0425A";
	[SerializeField] private string projectId = "RAPID-0425A";

	private Task initializationTask;
	private bool servicesInitialized;
	private bool playerAccountSubscriptionAdded;
	private bool playerAccountSignInInProgress;
	private bool authRequestInFlight;
	private bool signInLaunchMode;
	private bool runtimeUiBuilt;
	private bool legacyUiHidden;

	private Sprite solidUiSprite;
	private Sprite cardUiSprite;
	private Sprite moduleUiSprite;
	private Sprite controlUiSprite;
	private Sprite orbUiSprite;
	private TMP_FontAsset runtimeFont;
	private readonly List<UnityEngine.Object> generatedUiAssets = new List<UnityEngine.Object>();

	private GameObject runtimeRoot;
	private GameObject landingView;
	private GameObject loginOptionsView;
	private GameObject emailLoginView;
	private GameObject emailCreationView;
	private CanvasGroup runtimeRootGroup;
	private Tween panelVisibilityTween;

	private RectTransform runtimeCard;
	private TMP_Text sectionTitleLabel;
	private TMP_Text sectionBodyLabel;
	private TMP_Text statusLabel;
	private Image statusPanelImage;
	private GameObject statusPanel;

	private Button playAsGuestButton;
	private Button openLoginOptionsButton;
	private Button openEmailLoginButton;
	private Button openUnityLoginButton;
	private Button openCreateAccountButton;
	private Button loginOptionsBackButton;
	private Button emailLoginBackButton;
	private Button emailCreationBackButton;
	private Button emailLoginSubmitButton;
	private Button emailCreationSubmitButton;

	private TMP_InputField emailLoginUsernameInput;
	private TMP_InputField emailLoginPasswordInput;
	private TMP_InputField emailCreationUsernameInput;
	private TMP_InputField emailCreationPasswordInput;

	private readonly List<Selectable> interactiveControls = new List<Selectable>();

#if UNITY_WEBGL && !UNITY_EDITOR
	[DllImport("__Internal")]
	private static extern void UltraRapidShellNotifyAuthEvent(string state, string message);
#endif

	private async void Awake()
	{
		EnsureOverlayCanvas();
		EnsureRuntimeUi();
		ShowLandingView();
		SetPanelVisible(false);
		await InitializeServicesAsync();
	}

	private void OnDestroy()
	{
		if (panelVisibilityTween != null && panelVisibilityTween.IsActive())
		{
			panelVisibilityTween.Kill(false);
		}

		if (runtimeRoot != null)
		{
			DOTween.Kill(runtimeRoot, false);
		}

		if (runtimeCard != null)
		{
			DOTween.Kill(runtimeCard, false);
		}

		if (servicesInitialized && playerAccountSubscriptionAdded)
		{
			PlayerAccountService.Instance.SignedIn -= OnPlayerAccountSignedIn;
		}
		
		for (var i = 0; i < generatedUiAssets.Count; i++)
		{
			if (generatedUiAssets[i] != null)
			{
				Destroy(generatedUiAssets[i]);
			}
		}

		generatedUiAssets.Clear();
	}

	public void EnterSignInMode()
	{
		EnsureOverlayCanvas();
		EnsureRuntimeUi();
		signInLaunchMode = true;

		if (servicesInitialized && AuthenticationService.Instance.IsSignedIn && HasRecoverableIdentity())
		{
			HidePanel();
			return;
		}

		ShowLoginOptionsView();
		SetPanelVisible(true);
		NotifyWebShellAuthEvent("ready", string.Empty);
	}

	public void EnterPartnerLoginMode()
	{
		EnterSignInMode();
	}

	public void ShowLandingMode()
	{
		EnsureOverlayCanvas();
		EnsureRuntimeUi();
		signInLaunchMode = false;
		ShowLandingView();
		SetPanelVisible(true);
	}

	public void HideOverlay()
	{
		signInLaunchMode = false;
		SetStatusMessage(null, false);
		SetPanelVisible(false);
	}

	public async void PlayAsGuestButtonPressed()
	{
		await RunBusyAuthActionAsync("Starting your game...", async () =>
		{
			await InitializeServicesAsync();
			if (!AuthenticationService.Instance.IsSignedIn)
			{
				await AuthenticationService.Instance.SignInAnonymouslyAsync();
			}

			HidePanel();
		});
	}

	public void OpenLoginOptionsButtonPressed()
	{
		ShowLoginOptionsView();
	}

	public void OpenUsernamePasswordLoginButtonPressed()
	{
		ShowEmailLoginView();
	}

	public void OpenCreateAccountButtonPressed()
	{
		ShowEmailCreationView();
	}

	public async void SignInWithUsernamePasswordButtonPressed()
	{
		await RunBusyAuthActionAsync("Signing you in...", async () =>
		{
			await InitializeServicesAsync();

			var username = NormalizeUsername(emailLoginUsernameInput != null ? emailLoginUsernameInput.text : null);
			var password = emailLoginPasswordInput != null ? emailLoginPasswordInput.text : string.Empty;
			if (!ValidateCredentials(username, password, out var validationMessage))
			{
				SetStatusMessage(validationMessage, true);
				FocusValidationTarget(username, password, emailLoginUsernameInput, emailLoginPasswordInput);
				return;
			}

			var restoreGuestSessionOnFailure = AuthenticationService.Instance.IsSignedIn && !HasRecoverableIdentity();

			if (AuthenticationService.Instance.IsSignedIn)
			{
				if (string.Equals(AuthenticationService.Instance.PlayerInfo?.Username, username, StringComparison.OrdinalIgnoreCase))
				{
					HidePanel();
					return;
				}

				SignOutProviderSessions(clearSessionToken: false);
			}

			try
			{
				await AuthenticationService.Instance.SignInWithUsernamePasswordAsync(username, password);
				ClearCredentialInputs();
				HidePanel();
			}
			catch
			{
				if (restoreGuestSessionOnFailure && AuthenticationService.Instance.SessionTokenExists && !AuthenticationService.Instance.IsSignedIn)
				{
					await AuthenticationService.Instance.SignInAnonymouslyAsync();
				}

				throw;
			}
		});
	}

	public async void CreateUsernamePasswordAccountButtonPressed()
	{
		await RunBusyAuthActionAsync("Making your account...", async () =>
		{
			await InitializeServicesAsync();

			var username = NormalizeUsername(emailCreationUsernameInput != null ? emailCreationUsernameInput.text : null);
			var password = emailCreationPasswordInput != null ? emailCreationPasswordInput.text : string.Empty;
			if (!ValidateCredentials(username, password, out var validationMessage))
			{
				SetStatusMessage(validationMessage, true);
				FocusValidationTarget(username, password, emailCreationUsernameInput, emailCreationPasswordInput);
				return;
			}

			if (AuthenticationService.Instance.IsSignedIn)
			{
				if (HasUsernamePasswordLinked())
				{
					SetStatusMessage("This guest already has an account attached.", true);
					return;
				}

				await AuthenticationService.Instance.AddUsernamePasswordAsync(username, password);
			}
			else
			{
				await AuthenticationService.Instance.SignUpWithUsernamePasswordAsync(username, password);
			}

			ClearCredentialInputs();
			HidePanel();
		});
	}

	public void LoginButtonPressed()
	{
		EnterSignInMode();
	}

	public async void ContinueWithUnityPlayerAccountsButtonPressed()
	{
		await ContinueWithUnityPlayerAccountsButtonPressedAsync();
	}

	public void CodeLoginButtonPressed()
	{
#if UNITY_EDITOR || DEVELOPMENT_BUILD
		if (allowLegacyLocalCodeBypassInEditor && codeText != null && !string.IsNullOrWhiteSpace(codeText.text))
		{
			var expectedCode = string.IsNullOrWhiteSpace(legacyLocalAccessCode) ? projectId : legacyLocalAccessCode;
			if (codeText.text == expectedCode)
			{
				SetStatusMessage("Developer code bypass is on. Do not use this in a real build.", false);
				HidePanel();
				return;
			}
		}
#endif

		SetStatusMessage("Code sign-in is not available in this build.", true);
	}

	public void SignOut(bool clearSessionToken = false)
	{
		SignOutProviderSessions(clearSessionToken);
		SetStatusMessage("You signed out. You can play now or sign in again.", false);
		ShowLandingMode();
	}

	private async Task ContinueWithUnityPlayerAccountsButtonPressedAsync()
	{
		await RunBusyAuthActionAsync("Opening Unity account...", async () =>
		{
			await InitializeServicesAsync();

			if (!SupportsUnityPlayerAccountsSignIn())
			{
				SetStatusMessage("Unity account sign-in is not available in the browser. Use your username and password here.", true);
				return;
			}

			if (AuthenticationService.Instance.IsSignedIn && HasUnityIdentityLinked())
			{
				HidePanel();
				return;
			}

			if (playerAccountSignInInProgress)
			{
				SetStatusMessage("Unity account sign-in is already opening.", false);
				return;
			}

			await InitSignIn();
		});
	}

	private Task InitializeServicesAsync()
	{
		initializationTask ??= InitializeServicesCoreAsync();
		return initializationTask;
	}

	private async Task InitializeServicesCoreAsync()
	{
		try
		{
			if (!servicesInitialized)
			{
				await UnityServices.InitializeAsync();
				servicesInitialized = true;
			}

			if (!playerAccountSubscriptionAdded)
			{
				PlayerAccountService.Instance.SignedIn += OnPlayerAccountSignedIn;
				playerAccountSubscriptionAdded = true;
			}

			await RestoreCachedSessionOrCreateGuestAsync();
		}
		catch (ServicesInitializationException ex)
		{
			Debug.LogException(ex);
			SetStatusMessage("We could not start sign-in.", true);
		}
		catch (AuthenticationException ex)
		{
			Debug.LogWarning($"Authentication initialization failed: {ex.Message}");
			SetStatusMessage(ex.Message, true);
		}
		catch (RequestFailedException ex)
		{
			Debug.LogWarning($"Authentication initialization failed: {ex.Message}");
			SetStatusMessage(ex.Message, true);
		}
		catch (Exception ex)
		{
			Debug.LogException(ex);
			SetStatusMessage("Something went wrong while starting sign-in.", true);
		}
		finally
		{
			if (!servicesInitialized)
			{
				initializationTask = null;
			}
		}
	}

	private async Task RestoreCachedSessionOrCreateGuestAsync()
	{
		if (AuthenticationService.Instance.IsSignedIn)
		{
			TryHidePanelForRecoverableIdentity();
			return;
		}

		if (!AuthenticationService.Instance.SessionTokenExists && !signInAnonymouslyOnStartup)
		{
			return;
		}

		try
		{
			await AuthenticationService.Instance.SignInAnonymouslyAsync();
			TryHidePanelForRecoverableIdentity();
		}
		catch (AuthenticationException ex)
		{
			Debug.LogWarning($"Anonymous sign-in failed: {ex.Message}");
			if (signInLaunchMode)
			{
				SetStatusMessage(ex.Message, true);
			}
		}
		catch (RequestFailedException ex)
		{
			Debug.LogWarning($"Anonymous sign-in failed: {ex.Message}");
			if (signInLaunchMode)
			{
				SetStatusMessage(ex.Message, true);
			}
		}
	}

	public async Task InitSignIn()
	{
		try
		{
			playerAccountSignInInProgress = true;
			SetStatusMessage("Finish signing in with your Unity account.", false);
			await PlayerAccountService.Instance.StartSignInAsync();
		}
		catch (RequestFailedException ex)
		{
			Debug.LogWarning($"Unity Player Accounts sign-in failed: {ex.Message}");
			SetStatusMessage(ex.Message, true);
		}
		catch (Exception ex)
		{
			Debug.LogException(ex);
			SetStatusMessage("Something went wrong with Unity account sign-in.", true);
		}
		finally
		{
			playerAccountSignInInProgress = false;
		}
	}

	private async void OnPlayerAccountSignedIn()
	{
		try
		{
			await SignInOrLinkUnityAsync(PlayerAccountService.Instance.AccessToken);
		}
		catch (AuthenticationException ex)
		{
			Debug.LogWarning($"Unity Player Accounts sign-in failed: {ex.Message}");
			SetStatusMessage(ex.Message, true);
		}
		catch (RequestFailedException ex)
		{
			Debug.LogWarning($"Unity Player Accounts sign-in failed: {ex.Message}");
			SetStatusMessage(ex.Message, true);
		}
		catch (Exception ex)
		{
			Debug.LogException(ex);
			SetStatusMessage("Something went wrong with Unity account sign-in.", true);
		}
	}

	private async Task SignInOrLinkUnityAsync(string accessToken)
	{
		if (string.IsNullOrWhiteSpace(accessToken))
		{
			SetStatusMessage("Unity account sign-in did not finish.", true);
			return;
		}

		if (!AuthenticationService.Instance.IsSignedIn)
		{
			await AuthenticationService.Instance.SignInWithUnityAsync(accessToken);
			HidePanel();
			return;
		}

		if (HasUnityIdentityLinked())
		{
			HidePanel();
			return;
		}

		await LinkWithUnityAsync(accessToken);
	}

	private async Task LinkWithUnityAsync(string accessToken)
	{
		try
		{
			await AuthenticationService.Instance.LinkWithUnityAsync(accessToken);
			HidePanel();
		}
		catch (AuthenticationException ex) when (ex.ErrorCode == AuthenticationErrorCodes.AccountAlreadyLinked)
		{
			SetStatusMessage("That Unity account is already being used by a different player.", true);
		}
		catch (AuthenticationException ex)
		{
			Debug.LogWarning($"Unity Player Accounts link failed: {ex.Message}");
			SetStatusMessage(ex.Message, true);
		}
		catch (RequestFailedException ex)
		{
			Debug.LogWarning($"Unity Player Accounts link failed: {ex.Message}");
			SetStatusMessage(ex.Message, true);
		}
	}

	private async Task RunBusyAuthActionAsync(string busyMessage, Func<Task> action)
	{
		if (authRequestInFlight)
		{
			return;
		}

		authRequestInFlight = true;
		SetBusyState(true);
		SetStatusMessage(busyMessage, false);
		NotifyWebShellAuthEvent("busy", busyMessage);

		try
		{
			await action();
		}
		catch (AuthenticationException ex)
		{
			Debug.LogWarning($"Authentication failed: {ex.Message}");
			SetStatusMessage(ex.Message, true);
		}
		catch (RequestFailedException ex)
		{
			Debug.LogWarning($"Authentication request failed: {ex.Message}");
			SetStatusMessage(ex.Message, true);
		}
		catch (Exception ex)
		{
			Debug.LogException(ex);
			SetStatusMessage("Unexpected authentication error.", true);
		}
		finally
		{
			authRequestInFlight = false;
			SetBusyState(false);
			NotifyWebShellAuthEvent("idle", string.Empty);
		}
	}

	private void EnsureRuntimeUi()
	{
		if (runtimeUiBuilt)
		{
			return;
		}

		HideLegacyUiChildren();
		BuildRuntimeUi();
		WireRuntimeUi();
		runtimeUiBuilt = true;
	}

	private void HideLegacyUiChildren()
	{
		if (legacyUiHidden)
		{
			return;
		}

		for (var i = 0; i < transform.childCount; i++)
		{
			var child = transform.GetChild(i);
			if (child != null)
			{
				child.gameObject.SetActive(false);
			}
		}

		legacyUiHidden = true;
	}

	private void BuildRuntimeUi()
	{
		EnsureRuntimeSprites();
		runtimeFont = ResolveRuntimeFont();

		runtimeRoot = CreateRectObject("RuntimeAuthRoot", transform).gameObject;
		var runtimeRootRect = runtimeRoot.GetComponent<RectTransform>();
		Stretch(runtimeRootRect);

		runtimeRootGroup = runtimeRoot.AddComponent<CanvasGroup>();
		runtimeRootGroup.interactable = true;
		runtimeRootGroup.blocksRaycasts = true;
		runtimeRootGroup.alpha = 0f;

		var backdrop = CreateImage("Backdrop", runtimeRoot.transform, ShellBackdropColor);
		Stretch(backdrop.rectTransform);
		backdrop.raycastTarget = true;

		var topGlow = CreateImage("TopGlow", runtimeRoot.transform, new Color32(ShellAccentSoftColor.r, ShellAccentSoftColor.g, ShellAccentSoftColor.b, 24));
		var topGlowRect = topGlow.rectTransform;
		topGlowRect.anchorMin = new Vector2(0.5f, 1f);
		topGlowRect.anchorMax = new Vector2(0.5f, 1f);
		topGlowRect.pivot = new Vector2(0.5f, 1f);
		topGlowRect.anchoredPosition = new Vector2(0f, 0f);
		topGlowRect.sizeDelta = new Vector2(900f, 220f);

		var bottomGlow = CreateImage("BottomGlow", runtimeRoot.transform, new Color32(ShellAccentColor.r, ShellAccentColor.g, ShellAccentColor.b, 18));
		var bottomGlowRect = bottomGlow.rectTransform;
		bottomGlowRect.anchorMin = new Vector2(0.5f, 0f);
		bottomGlowRect.anchorMax = new Vector2(0.5f, 0f);
		bottomGlowRect.pivot = new Vector2(0.5f, 0f);
		bottomGlowRect.anchoredPosition = new Vector2(0f, 0f);
		bottomGlowRect.sizeDelta = new Vector2(980f, 180f);

		runtimeCard = CreateRectObject("ShellAuthCard", runtimeRoot.transform);
		runtimeCard.anchorMin = new Vector2(0.5f, 0.5f);
		runtimeCard.anchorMax = new Vector2(0.5f, 0.5f);
		runtimeCard.pivot = new Vector2(0.5f, 0.5f);
		runtimeCard.anchoredPosition = new Vector2(0f, 0f);
		runtimeCard.sizeDelta = new Vector2(620f, 724f);
		runtimeCard.localScale = new Vector3(0.965f, 0.965f, 1f);

		var cardBackground = runtimeCard.gameObject.AddComponent<Image>();
		cardBackground.sprite = cardUiSprite;
		cardBackground.type = Image.Type.Sliced;
		cardBackground.color = ShellPanelColor;

		var cardOutline = runtimeCard.gameObject.AddComponent<Outline>();
		cardOutline.effectColor = ShellBorderColor;
		cardOutline.effectDistance = new Vector2(1f, -1f);
		cardOutline.useGraphicAlpha = true;

		var cardShadow = runtimeCard.gameObject.AddComponent<Shadow>();
		cardShadow.effectColor = new Color32(0, 0, 0, 120);
		cardShadow.effectDistance = new Vector2(0f, -16f);
		cardShadow.useGraphicAlpha = false;

		var cardLayout = runtimeCard.gameObject.AddComponent<VerticalLayoutGroup>();
		cardLayout.padding = new RectOffset(28, 28, 24, 24);
		cardLayout.spacing = 16f;
		cardLayout.childAlignment = TextAnchor.UpperCenter;
		cardLayout.childControlWidth = true;
		cardLayout.childControlHeight = true;
		cardLayout.childForceExpandHeight = false;
		cardLayout.childForceExpandWidth = true;

		var accentLine = CreateImage("AccentLine", runtimeCard, ShellAccentColor);
		var accentLayout = accentLine.gameObject.AddComponent<LayoutElement>();
		accentLayout.minHeight = 2f;
		accentLayout.preferredHeight = 2f;

		var heroPanel = CreateRectObject("HeroPanel", runtimeCard);
		var heroLayoutElement = heroPanel.gameObject.AddComponent<LayoutElement>();
		heroLayoutElement.minHeight = 186f;
		heroLayoutElement.preferredHeight = 186f;

		var heroImage = heroPanel.gameObject.AddComponent<Image>();
		heroImage.sprite = moduleUiSprite;
		heroImage.type = Image.Type.Sliced;
		heroImage.color = ShellGlassPanelColor;

		var heroOutline = heroPanel.gameObject.AddComponent<Outline>();
		heroOutline.effectColor = new Color32(255, 255, 255, 18);
		heroOutline.effectDistance = new Vector2(1f, -1f);
		heroOutline.useGraphicAlpha = true;

		var heroShadow = heroPanel.gameObject.AddComponent<Shadow>();
		heroShadow.effectColor = new Color32(0, 0, 0, 70);
		heroShadow.effectDistance = new Vector2(0f, -10f);
		heroShadow.useGraphicAlpha = false;

		var heroOrbLeft = CreateDecorativeOrb(heroPanel, "HeroOrbLeft", new Vector2(96f, 96f), new Vector2(42f, -24f), TextAnchor.UpperLeft, new Color32(ShellAccentSoftColor.r, ShellAccentSoftColor.g, ShellAccentSoftColor.b, 42));
		var heroPill = CreateDecorativePill(heroPanel, "HeroPill", new Vector2(132f, 38f), new Vector2(-28f, -22f), TextAnchor.UpperRight, new Color32(ShellAccentColor.r, ShellAccentColor.g, ShellAccentColor.b, 26));

		StartAmbientFloat(heroOrbLeft.rectTransform, 8f, 4.8f, 0f);
		StartAmbientFloat(heroPill.rectTransform, 6f, 5.2f, 0.35f);

		var heroContent = CreateRectObject("HeroContent", heroPanel);
		Stretch(heroContent);
		var heroContentLayout = heroContent.gameObject.AddComponent<VerticalLayoutGroup>();
		heroContentLayout.padding = new RectOffset(24, 24, 22, 20);
		heroContentLayout.spacing = 10f;
		heroContentLayout.childAlignment = TextAnchor.UpperLeft;
		heroContentLayout.childControlWidth = true;
		heroContentLayout.childControlHeight = true;
		heroContentLayout.childForceExpandWidth = true;
		heroContentLayout.childForceExpandHeight = false;

		var heroBadge = CreateText("HeroBadge", heroContent, "SAVE WHEN YOU WANT", 12f, FontStyles.Bold, ShellAccentColor, TextAlignmentOptions.Left);
		heroBadge.characterSpacing = 7f;

		var heroHeadline = CreateText("HeroHeadline", heroContent, "Play now. Save later.", 33f, FontStyles.Bold, ShellTextColor, TextAlignmentOptions.Left);
		heroHeadline.textWrappingMode = TextWrappingModes.Normal;
		heroHeadline.lineSpacing = 4f;

		var heroCopy = CreateText("HeroCopy", heroContent, "You do not need an account to start. Make one only if you want to keep your progress.", 17f, FontStyles.Normal, ShellMutedTextColor, TextAlignmentOptions.Left);
		heroCopy.textWrappingMode = TextWrappingModes.Normal;
		heroCopy.lineSpacing = 6f;

		var module = CreateRectObject("AuthModule", runtimeCard);
		var moduleImage = module.gameObject.AddComponent<Image>();
		moduleImage.sprite = moduleUiSprite;
		moduleImage.type = Image.Type.Sliced;
		moduleImage.color = ShellModuleColor;
		var moduleLayoutElement = module.gameObject.AddComponent<LayoutElement>();
		moduleLayoutElement.flexibleHeight = 1f;
		moduleLayoutElement.minHeight = 390f;
		var moduleOutline = module.gameObject.AddComponent<Outline>();
		moduleOutline.effectColor = new Color32(255, 255, 255, 14);
		moduleOutline.effectDistance = new Vector2(1f, -1f);
		moduleOutline.useGraphicAlpha = true;
		var moduleLayout = module.gameObject.AddComponent<VerticalLayoutGroup>();
		moduleLayout.padding = new RectOffset(24, 24, 24, 24);
		moduleLayout.spacing = 14f;
		moduleLayout.childAlignment = TextAnchor.UpperCenter;
		moduleLayout.childControlWidth = true;
		moduleLayout.childControlHeight = true;
		moduleLayout.childForceExpandHeight = false;
		moduleLayout.childForceExpandWidth = true;

		sectionTitleLabel = CreateText("SectionTitle", module, "How do you want to start?", 28f, FontStyles.Bold, ShellTextColor, TextAlignmentOptions.Center);
		sectionBodyLabel = CreateText("SectionBody", module, "Pick one. You can change this later.", 16f, FontStyles.Normal, ShellMutedTextColor, TextAlignmentOptions.Center);
		sectionBodyLabel.textWrappingMode = TextWrappingModes.Normal;
		sectionBodyLabel.lineSpacing = 4f;

		statusPanel = CreateRectObject("StatusPanel", module).gameObject;
		var statusLayout = statusPanel.AddComponent<LayoutElement>();
		statusLayout.minHeight = 52f;
		statusLayout.preferredHeight = -1f;
		var statusFitter = statusPanel.AddComponent<ContentSizeFitter>();
		statusFitter.horizontalFit = ContentSizeFitter.FitMode.Unconstrained;
		statusFitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
		statusPanelImage = statusPanel.AddComponent<Image>();
		statusPanelImage.sprite = controlUiSprite;
		statusPanelImage.type = Image.Type.Sliced;
		statusPanelImage.color = ShellInfoPanelColor;
		var statusOutline = statusPanel.AddComponent<Outline>();
		statusOutline.effectColor = new Color32(255, 255, 255, 18);
		statusOutline.effectDistance = new Vector2(1f, -1f);
		statusOutline.useGraphicAlpha = true;
		statusLabel = CreateText("StatusText", statusPanel.transform, string.Empty, 16f, FontStyles.Normal, ShellMutedTextColor, TextAlignmentOptions.Center);
		Stretch(statusLabel.rectTransform);
		statusLabel.rectTransform.offsetMin = new Vector2(18f, 10f);
		statusLabel.rectTransform.offsetMax = new Vector2(-18f, -10f);
		statusLabel.textWrappingMode = TextWrappingModes.Normal;
		statusLabel.lineSpacing = 6f;
		statusPanel.SetActive(false);

		landingView = CreateStack("LandingView", module.gameObject, 12f);
		playAsGuestButton = CreateActionButton(landingView.transform, "PlayAsGuestButton", "Play now", AuthButtonStyle.Primary);
		openLoginOptionsButton = CreateActionButton(landingView.transform, "OpenSignInButton", "Save my progress", AuthButtonStyle.Secondary);
		var landingHint = CreateText("LandingHint", landingView.transform, "You can always keep playing as a guest first.", 14f, FontStyles.Normal, ShellFaintTextColor, TextAlignmentOptions.Center);
		landingHint.textWrappingMode = TextWrappingModes.Normal;
		landingHint.lineSpacing = 5f;

		loginOptionsView = CreateStack("LoginOptionsView", module.gameObject, 12f);
		openEmailLoginButton = CreateActionButton(loginOptionsView.transform, "UsernamePasswordButton", "I have an account", AuthButtonStyle.Primary);
		openCreateAccountButton = CreateActionButton(loginOptionsView.transform, "CreateAccountButton", "Make a new account", AuthButtonStyle.Secondary);
		openUnityLoginButton = CreateActionButton(loginOptionsView.transform, "UnityIdButton", "Use Unity account", AuthButtonStyle.Secondary);
		loginOptionsBackButton = CreateActionButton(loginOptionsView.transform, "SignInBackButton", "Back", AuthButtonStyle.Ghost);

		emailLoginView = CreateStack("EmailLoginView", module.gameObject, 12f);
		CreateFormLabel(emailLoginView.transform, "LoginUsernameLabel", "Username");
		emailLoginUsernameInput = CreateInputField(emailLoginView.transform, "LoginUsernameInput", "Type your username", false);
		CreateFormLabel(emailLoginView.transform, "LoginPasswordLabel", "Password");
		emailLoginPasswordInput = CreateInputField(emailLoginView.transform, "LoginPasswordInput", "Type your password", true);
		emailLoginSubmitButton = CreateActionButton(emailLoginView.transform, "EmailLoginSubmitButton", "Continue", AuthButtonStyle.Primary);
		emailLoginBackButton = CreateActionButton(emailLoginView.transform, "EmailLoginBackButton", "Back", AuthButtonStyle.Ghost);

		emailCreationView = CreateStack("EmailCreationView", module.gameObject, 12f);
		CreateFormLabel(emailCreationView.transform, "CreateUsernameLabel", "Username");
		emailCreationUsernameInput = CreateInputField(emailCreationView.transform, "CreateUsernameInput", "Choose a username", false);
		CreateFormLabel(emailCreationView.transform, "CreatePasswordLabel", "Password");
		emailCreationPasswordInput = CreateInputField(emailCreationView.transform, "CreatePasswordInput", "Make a password", true);
		var creationHintLabel = CreateText("CreateHint", emailCreationView.transform, "Use 8-30 characters with a capital letter, a small letter, a number, and a symbol.", 14f, FontStyles.Normal, ShellFaintTextColor, TextAlignmentOptions.Left);
		creationHintLabel.textWrappingMode = TextWrappingModes.Normal;
		creationHintLabel.lineSpacing = 5f;
		emailCreationSubmitButton = CreateActionButton(emailCreationView.transform, "CreateAccountSubmitButton", "Create my account", AuthButtonStyle.Primary);
		emailCreationBackButton = CreateActionButton(emailCreationView.transform, "EmailCreationBackButton", "Back", AuthButtonStyle.Ghost);

		ForceLayoutRefresh();
	}

	private void WireRuntimeUi()
	{
		ReplaceButtonHandler(playAsGuestButton, PlayAsGuestButtonPressed);
		ReplaceButtonHandler(openLoginOptionsButton, OpenLoginOptionsButtonPressed);
		ReplaceButtonHandler(openEmailLoginButton, OpenUsernamePasswordLoginButtonPressed);
		ReplaceButtonHandler(openCreateAccountButton, OpenCreateAccountButtonPressed);
		ReplaceButtonHandler(loginOptionsBackButton, ShowLandingView);
		ReplaceButtonHandler(emailLoginBackButton, ShowLoginOptionsView);
		ReplaceButtonHandler(emailCreationBackButton, ShowLoginOptionsView);
		ReplaceButtonHandler(emailLoginSubmitButton, SignInWithUsernamePasswordButtonPressed);
		ReplaceButtonHandler(emailCreationSubmitButton, CreateUsernamePasswordAccountButtonPressed);

		if (SupportsUnityPlayerAccountsSignIn())
		{
			ReplaceButtonHandler(openUnityLoginButton, ContinueWithUnityPlayerAccountsButtonPressed);
		}
		else
		{
			openUnityLoginButton.gameObject.SetActive(false);
		}

		RegisterNextFieldHandler(emailLoginUsernameInput, emailLoginPasswordInput);
		RegisterSubmitHandler(emailLoginPasswordInput, SignInWithUsernamePasswordButtonPressed);
		RegisterNextFieldHandler(emailCreationUsernameInput, emailCreationPasswordInput);
		RegisterSubmitHandler(emailCreationPasswordInput, CreateUsernamePasswordAccountButtonPressed);

		RegisterInputClearHandler(emailLoginUsernameInput);
		RegisterInputClearHandler(emailLoginPasswordInput);
		RegisterInputClearHandler(emailCreationUsernameInput);
		RegisterInputClearHandler(emailCreationPasswordInput);
	}

	private void RegisterSubmitHandler(TMP_InputField inputField, Action handler)
	{
		if (inputField == null || handler == null)
		{
			return;
		}

		inputField.onSubmit.AddListener(_ => handler());
	}

	private void RegisterNextFieldHandler(TMP_InputField inputField, TMP_InputField nextField)
	{
		if (inputField == null || nextField == null)
		{
			return;
		}

		inputField.onSubmit.AddListener(_ => FocusInputFieldNextFrame(nextField));
	}

	private void RegisterInputClearHandler(TMP_InputField inputField)
	{
		if (inputField == null)
		{
			return;
		}

		inputField.onValueChanged.AddListener(_ =>
		{
			if (!authRequestInFlight)
			{
				SetStatusMessage(null, false);
			}
		});
	}

	private void ShowLandingView()
	{
		EnsureRuntimeUi();
		SetSectionCopy(
			"Start here",
			"Play right away, or save your progress for later."
		);
		SetStatusMessage(null, false);

		SetViewVisible(landingView, true);
		SetViewVisible(loginOptionsView, false);
		SetViewVisible(emailLoginView, false);
		SetViewVisible(emailCreationView, false);
		ForceLayoutRefresh();
	}

	private void ShowLoginOptionsView()
	{
		EnsureRuntimeUi();
		SetSectionCopy(
			"Save my progress",
			"Use an account you already have, or make a new one."
		);
		SetStatusMessage(null, false);

		SetViewVisible(landingView, false);
		SetViewVisible(loginOptionsView, true);
		SetViewVisible(emailLoginView, false);
		SetViewVisible(emailCreationView, false);

		if (openUnityLoginButton != null)
		{
			var showUnityId = SupportsUnityPlayerAccountsSignIn();
			openUnityLoginButton.gameObject.SetActive(showUnityId);
		}

		ForceLayoutRefresh();
	}

	private void ShowEmailLoginView()
	{
		EnsureRuntimeUi();
		SetSectionCopy(
			"Welcome back",
			"Type your username and password to keep going."
		);
		SetStatusMessage(null, false);

		SetViewVisible(landingView, false);
		SetViewVisible(loginOptionsView, false);
		SetViewVisible(emailLoginView, true);
		SetViewVisible(emailCreationView, false);
		ForceLayoutRefresh();
		FocusInputFieldNextFrame(emailLoginUsernameInput);
	}

	private void ShowEmailCreationView()
	{
		EnsureRuntimeUi();
		SetSectionCopy(
			"Make a new account",
			"Pick a username and password so your progress is saved."
		);
		SetStatusMessage(null, false);

		SetViewVisible(landingView, false);
		SetViewVisible(loginOptionsView, false);
		SetViewVisible(emailLoginView, false);
		SetViewVisible(emailCreationView, true);
		ForceLayoutRefresh();
		FocusInputFieldNextFrame(emailCreationUsernameInput);
	}

	private bool HasUnityIdentityLinked()
	{
		var playerInfo = AuthenticationService.Instance.PlayerInfo;
		if (playerInfo?.Identities == null)
		{
			return false;
		}

		for (var i = 0; i < playerInfo.Identities.Count; i++)
		{
			var identity = playerInfo.Identities[i];
			if (identity != null && identity.TypeId == UnityIdentityProviderId)
			{
				return true;
			}
		}

		return false;
	}

	private bool HasUsernamePasswordLinked()
	{
		return !string.IsNullOrWhiteSpace(AuthenticationService.Instance.PlayerInfo?.Username);
	}

	private bool HasRecoverableIdentity()
	{
		return HasUnityIdentityLinked() || HasUsernamePasswordLinked();
	}

	private void TryHidePanelForRecoverableIdentity()
	{
		if (HasRecoverableIdentity())
		{
			HidePanel();
		}
	}

	private void HidePanel()
	{
		var notifyShell = signInLaunchMode;
		signInLaunchMode = false;
		SetStatusMessage(null, false);
		SetPanelVisible(false);
		if (notifyShell)
		{
			NotifyWebShellAuthEvent("authenticated", string.Empty);
		}
	}

	private void SetPanelVisible(bool visible)
	{
		if (runtimeRoot == null || runtimeRootGroup == null || runtimeCard == null)
		{
			if (runtimeRoot != null)
			{
				runtimeRoot.SetActive(visible);
			}
			return;
		}

		if (panelVisibilityTween != null && panelVisibilityTween.IsActive())
		{
			panelVisibilityTween.Kill(false);
		}

		runtimeRoot.SetActive(true);
		ForceLayoutRefresh();

		runtimeRootGroup.blocksRaycasts = visible;
		runtimeRootGroup.interactable = visible;

		var startAlpha = runtimeRootGroup.alpha;
		var targetAlpha = visible ? 1f : 0f;
		var hiddenScale = new Vector3(0.965f, 0.965f, 1f);
		var shownScale = Vector3.one;
		var startScale = runtimeCard.localScale;
		var targetScale = visible ? shownScale : hiddenScale;
		var hiddenPosition = new Vector2(0f, 20f);
		var shownPosition = Vector2.zero;
		var startPosition = runtimeCard.anchoredPosition;
		var targetPosition = visible ? shownPosition : hiddenPosition;

		if (visible && startAlpha <= 0.001f)
		{
			startScale = hiddenScale;
			runtimeCard.localScale = hiddenScale;
			startPosition = hiddenPosition;
			runtimeCard.anchoredPosition = hiddenPosition;
		}

		runtimeRootGroup.alpha = startAlpha;
		runtimeCard.localScale = startScale;
		runtimeCard.anchoredPosition = startPosition;

		panelVisibilityTween = DOTween.Sequence()
			.SetUpdate(true)
			.SetTarget(runtimeCard)
			.Join(runtimeRootGroup.DOFade(targetAlpha, 0.24f).SetEase(visible ? Ease.OutQuad : Ease.InQuad))
			.Join(runtimeCard.DOScale(targetScale, 0.26f).SetEase(visible ? Ease.OutBack : Ease.InBack))
			.Join(runtimeCard.DOAnchorPos(targetPosition, 0.24f).SetEase(visible ? Ease.OutCubic : Ease.InCubic))
			.OnComplete(() =>
			{
				runtimeRootGroup.alpha = targetAlpha;
				runtimeCard.localScale = targetScale;
				runtimeCard.anchoredPosition = targetPosition;

				if (!visible)
				{
					runtimeRoot.SetActive(false);
				}

				panelVisibilityTween = null;
			});
	}

	private void FocusInputFieldNextFrame(TMP_InputField inputField)
	{
		if (inputField == null || !isActiveAndEnabled)
		{
			return;
		}

		StartCoroutine(FocusInputFieldCoroutine(inputField));
	}

	private System.Collections.IEnumerator FocusInputFieldCoroutine(TMP_InputField inputField)
	{
		yield return null;

		if (inputField == null || !inputField.gameObject.activeInHierarchy)
		{
			yield break;
		}

		if (EventSystem.current != null)
		{
			EventSystem.current.SetSelectedGameObject(inputField.gameObject);
		}

		inputField.ActivateInputField();
	}

	private void EnsureOverlayCanvas()
	{
		if (transform is RectTransform rootRect)
		{
			rootRect.anchorMin = Vector2.zero;
			rootRect.anchorMax = Vector2.one;
			rootRect.pivot = new Vector2(0.5f, 0.5f);
			rootRect.anchoredPosition = Vector2.zero;
			rootRect.sizeDelta = Vector2.zero;
		}

		var canvas = GetComponent<Canvas>();
		if (canvas == null)
		{
			canvas = gameObject.AddComponent<Canvas>();
		}

		canvas.renderMode = RenderMode.ScreenSpaceOverlay;
		canvas.overrideSorting = true;
		canvas.sortingOrder = 5000;

		if (GetComponent<GraphicRaycaster>() == null)
		{
			gameObject.AddComponent<GraphicRaycaster>();
		}

		var scaler = GetComponent<CanvasScaler>();
		if (scaler == null)
		{
			scaler = gameObject.AddComponent<CanvasScaler>();
		}

		scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
		scaler.referenceResolution = new Vector2(1920f, 1080f);
		scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
		scaler.matchWidthOrHeight = 0.5f;
	}

	private void SignOutProviderSessions(bool clearSessionToken)
	{
		if (AuthenticationService.Instance.IsSignedIn)
		{
			AuthenticationService.Instance.SignOut(clearSessionToken);
		}

		try
		{
			PlayerAccountService.Instance.SignOut();
		}
		catch (ServicesInitializationException)
		{
			// Player Accounts was never initialized for this session.
		}
	}

	private static string NormalizeUsername(string username)
	{
		return string.IsNullOrWhiteSpace(username) ? string.Empty : username.Trim();
	}

	private static bool ValidateCredentials(string username, string password, out string message)
	{
		if (!Regex.IsMatch(username ?? string.Empty, UsernamePattern))
		{
			message = "Use 3-20 letters or numbers for your username. You can also use . _ @ or -.";
			return false;
		}

		if (string.IsNullOrEmpty(password) || password.Length < 8 || password.Length > 30)
		{
			message = "Use 8-30 characters for your password.";
			return false;
		}

		var hasUpper = false;
		var hasLower = false;
		var hasDigit = false;
		var hasSymbol = false;

		for (var i = 0; i < password.Length; i++)
		{
			var character = password[i];
			if (char.IsUpper(character))
			{
				hasUpper = true;
			}
			else if (char.IsLower(character))
			{
				hasLower = true;
			}
			else if (char.IsDigit(character))
			{
				hasDigit = true;
			}
			else
			{
				hasSymbol = true;
			}
		}

		if (!hasUpper || !hasLower || !hasDigit || !hasSymbol)
		{
			message = "Add a capital letter, a small letter, a number, and a symbol.";
			return false;
		}

		message = null;
		return true;
	}

	private void FocusValidationTarget(string username, string password, TMP_InputField usernameField, TMP_InputField passwordField)
	{
		if (!Regex.IsMatch(username ?? string.Empty, UsernamePattern))
		{
			FocusInputFieldNextFrame(usernameField);
			return;
		}

		FocusInputFieldNextFrame(passwordField);
	}

	private void ClearCredentialInputs()
	{
		if (emailLoginPasswordInput != null)
		{
			emailLoginPasswordInput.text = string.Empty;
		}

		if (emailCreationPasswordInput != null)
		{
			emailCreationPasswordInput.text = string.Empty;
		}
	}

	private void SetBusyState(bool busy)
	{
		for (var i = 0; i < interactiveControls.Count; i++)
		{
			if (interactiveControls[i] != null)
			{
				interactiveControls[i].interactable = !busy;
			}
		}
	}

	private void ForceLayoutRefresh()
	{
		if (runtimeCard == null)
		{
			return;
		}

		Canvas.ForceUpdateCanvases();
		LayoutRebuilder.ForceRebuildLayoutImmediate(runtimeCard);
	}

	private void SetSectionCopy(string title, string body)
	{
		if (sectionTitleLabel != null)
		{
			sectionTitleLabel.text = title;
		}

		if (sectionBodyLabel != null)
		{
			sectionBodyLabel.text = body;
		}
	}

	private void SetStatusMessage(string message, bool isError)
	{
		if (statusLabel == null || statusPanel == null)
		{
			return;
		}

		var hasMessage = !string.IsNullOrWhiteSpace(message);
		statusPanel.SetActive(hasMessage);
		if (!hasMessage)
		{
			statusLabel.text = string.Empty;
			ForceLayoutRefresh();
			return;
		}

		statusLabel.text = message;
		statusLabel.color = isError ? ShellDangerColor : ShellAccentSoftColor;
		if (statusPanelImage != null)
		{
			statusPanelImage.color = isError ? ShellErrorPanelColor : ShellInfoPanelColor;
		}

		ForceLayoutRefresh();
		if (isError)
		{
			NotifyWebShellAuthEvent("error", message);
		}
	}

	private void SetViewVisible(GameObject view, bool visible)
	{
		if (view != null)
		{
			view.SetActive(visible);
		}
	}

	private void RegisterSelectable(Selectable selectable)
	{
		if (selectable != null)
		{
			interactiveControls.Add(selectable);
		}
	}

	private TMP_FontAsset ResolveRuntimeFont()
	{
		if (TMP_Settings.defaultFontAsset != null)
		{
			return TMP_Settings.defaultFontAsset;
		}

		return Resources.Load<TMP_FontAsset>("Fonts & Materials/LiberationSans SDF");
	}

	private static RectTransform CreateRectObject(string name, Transform parent)
	{
		var gameObject = new GameObject(name, typeof(RectTransform));
		var rectTransform = gameObject.GetComponent<RectTransform>();
		rectTransform.SetParent(parent, false);
		rectTransform.localScale = Vector3.one;
		return rectTransform;
	}

	private static void Stretch(RectTransform rectTransform)
	{
		rectTransform.anchorMin = Vector2.zero;
		rectTransform.anchorMax = Vector2.one;
		rectTransform.offsetMin = Vector2.zero;
		rectTransform.offsetMax = Vector2.zero;
		rectTransform.anchoredPosition = Vector2.zero;
		rectTransform.sizeDelta = Vector2.zero;
	}

	private Image CreateImage(string name, Transform parent, Color color)
	{
		var rect = CreateRectObject(name, parent);
		var image = rect.gameObject.AddComponent<Image>();
		image.sprite = solidUiSprite;
		image.type = Image.Type.Simple;
		image.color = color;
		return image;
	}

	private Image CreateDecorativeOrb(Transform parent, string name, Vector2 size, Vector2 anchoredPosition, TextAnchor anchor, Color color)
	{
		var rect = CreateRectObject(name, parent);
		rect.anchorMin = AnchorToNormalized(anchor);
		rect.anchorMax = rect.anchorMin;
		rect.pivot = new Vector2(0.5f, 0.5f);
		rect.anchoredPosition = anchoredPosition;
		rect.sizeDelta = size;

		var image = rect.gameObject.AddComponent<Image>();
		image.sprite = orbUiSprite;
		image.type = Image.Type.Simple;
		image.color = color;
		image.raycastTarget = false;
		return image;
	}

	private Image CreateDecorativePill(Transform parent, string name, Vector2 size, Vector2 anchoredPosition, TextAnchor anchor, Color color)
	{
		var rect = CreateRectObject(name, parent);
		rect.anchorMin = AnchorToNormalized(anchor);
		rect.anchorMax = rect.anchorMin;
		rect.pivot = new Vector2(0.5f, 0.5f);
		rect.anchoredPosition = anchoredPosition;
		rect.sizeDelta = size;

		var image = rect.gameObject.AddComponent<Image>();
		image.sprite = controlUiSprite;
		image.type = Image.Type.Sliced;
		image.color = color;
		image.raycastTarget = false;
		return image;
	}

	private static Vector2 AnchorToNormalized(TextAnchor anchor)
	{
		switch (anchor)
		{
			case TextAnchor.UpperLeft:
				return new Vector2(0f, 1f);
			case TextAnchor.UpperRight:
				return new Vector2(1f, 1f);
			case TextAnchor.LowerRight:
				return new Vector2(1f, 0f);
			case TextAnchor.LowerLeft:
				return new Vector2(0f, 0f);
			case TextAnchor.MiddleLeft:
				return new Vector2(0f, 0.5f);
			case TextAnchor.MiddleRight:
				return new Vector2(1f, 0.5f);
			case TextAnchor.LowerCenter:
				return new Vector2(0.5f, 0f);
			case TextAnchor.UpperCenter:
				return new Vector2(0.5f, 1f);
			default:
				return new Vector2(0.5f, 0.5f);
		}
	}

	private void StartAmbientFloat(RectTransform target, float distance, float duration, float delay)
	{
		if (target == null)
		{
			return;
		}

		var startPos = target.anchoredPosition;
		var startScale = target.localScale;
		DOTween.Sequence()
			.SetUpdate(true)
			.SetDelay(delay)
			.SetLoops(-1, LoopType.Yoyo)
			.SetEase(Ease.InOutSine)
			.SetTarget(target)
			.SetLink(target.gameObject, LinkBehaviour.KillOnDestroy)
			.Append(target.DOAnchorPosY(startPos.y + distance, duration))
			.Join(target.DOScale(startScale * 1.035f, duration));
	}

	private GameObject CreateStack(string name, GameObject parent, float spacing)
	{
		var rect = CreateRectObject(name, parent.transform);
		var layout = rect.gameObject.AddComponent<VerticalLayoutGroup>();
		layout.padding = new RectOffset(0, 0, 0, 0);
		layout.spacing = spacing;
		layout.childAlignment = TextAnchor.UpperCenter;
		layout.childControlWidth = true;
		layout.childControlHeight = true;
		layout.childForceExpandWidth = true;
		layout.childForceExpandHeight = false;
		return rect.gameObject;
	}

	private TMP_Text CreateText(string name, Transform parent, string content, float fontSize, FontStyles fontStyle, Color color, TextAlignmentOptions alignment)
	{
		var rect = CreateRectObject(name, parent);
		var text = rect.gameObject.AddComponent<TextMeshProUGUI>();
		text.font = runtimeFont;
		text.text = content;
		text.fontSize = fontSize;
		text.fontStyle = fontStyle;
		text.color = color;
		text.alignment = alignment;
		text.textWrappingMode = TextWrappingModes.NoWrap;
		text.raycastTarget = false;
		text.margin = new Vector4(0f, 0f, 0f, 0f);
		return text;
	}

	private TMP_Text CreateFormLabel(Transform parent, string name, string content)
	{
		var label = CreateText(name, parent, content.ToUpperInvariant(), 13f, FontStyles.Bold, ShellAccentSoftColor, TextAlignmentOptions.Left);
		label.characterSpacing = 6f;
		return label;
	}

	private Button CreateActionButton(Transform parent, string name, string label, AuthButtonStyle style)
	{
		var rect = CreateRectObject(name, parent);
		var layout = rect.gameObject.AddComponent<LayoutElement>();
		layout.minHeight = 66f;
		layout.preferredHeight = 66f;

		var image = rect.gameObject.AddComponent<Image>();
		image.sprite = controlUiSprite;
		image.type = Image.Type.Sliced;

		var outline = rect.gameObject.AddComponent<Outline>();
		outline.effectDistance = new Vector2(1f, -1f);
		outline.useGraphicAlpha = true;

		var button = rect.gameObject.AddComponent<Button>();
		button.targetGraphic = image;

		var labelText = CreateText("Label", rect, label, 17f, FontStyles.Bold, ShellTextColor, TextAlignmentOptions.Center);
		Stretch(labelText.rectTransform);
		labelText.characterSpacing = 3f;

		ApplyButtonStyle(button, image, outline, labelText, style);
		AddButtonMotion(button, style == AuthButtonStyle.Primary ? 1.028f : 1.02f);
		RegisterSelectable(button);
		return button;
	}

	private void AddButtonMotion(Button button, float hoverScale)
	{
		if (button == null)
		{
			return;
		}

		var trigger = button.gameObject.GetComponent<EventTrigger>();
		if (trigger == null)
		{
			trigger = button.gameObject.AddComponent<EventTrigger>();
		}

		var target = button.transform;
		var baseScale = Vector3.one;

		void AddEvent(EventTriggerType eventType, Action action)
		{
			var entry = new EventTrigger.Entry { eventID = eventType };
			entry.callback.AddListener(_ => action());
			trigger.triggers.Add(entry);
		}

		void TweenScale(Vector3 scale, float duration, Ease ease)
		{
			DOTween.Kill(target, false);
			target.DOScale(scale, duration)
				.SetUpdate(true)
				.SetTarget(target)
				.SetLink(button.gameObject, LinkBehaviour.KillOnDestroy)
				.SetEase(ease);
		}

		AddEvent(EventTriggerType.PointerEnter, () => TweenScale(baseScale * hoverScale, 0.16f, Ease.OutQuad));
		AddEvent(EventTriggerType.PointerExit, () => TweenScale(baseScale, 0.16f, Ease.OutQuad));
		AddEvent(EventTriggerType.PointerDown, () => TweenScale(baseScale * 0.985f, 0.08f, Ease.OutQuad));
		AddEvent(EventTriggerType.PointerUp, () => TweenScale(baseScale * hoverScale, 0.12f, Ease.OutQuad));
		AddEvent(EventTriggerType.Select, () => TweenScale(baseScale * hoverScale, 0.16f, Ease.OutQuad));
		AddEvent(EventTriggerType.Deselect, () => TweenScale(baseScale, 0.16f, Ease.OutQuad));
	}

	private void ApplyButtonStyle(Button button, Image image, Outline outline, TMP_Text label, AuthButtonStyle style)
	{
		var colors = button.colors;
		colors.colorMultiplier = 1f;
		colors.fadeDuration = 0.08f;

		switch (style)
		{
			case AuthButtonStyle.Primary:
				image.color = ShellAccentColor;
				label.color = ShellPrimaryTextColor;
				outline.effectColor = new Color32(255, 255, 255, 0);
				colors.normalColor = Color.white;
				colors.highlightedColor = new Color32(240, 255, 150, 255);
				colors.pressedColor = new Color32(190, 225, 55, 255);
				colors.selectedColor = colors.highlightedColor;
				colors.disabledColor = new Color32(150, 160, 110, 160);
				break;
			case AuthButtonStyle.Secondary:
				image.color = new Color32(255, 255, 255, 10);
				label.color = ShellAccentColor;
				outline.effectColor = ShellBorderStrongColor;
				colors.normalColor = Color.white;
				colors.highlightedColor = new Color32(255, 255, 255, 36);
				colors.pressedColor = new Color32(255, 255, 255, 18);
				colors.selectedColor = colors.highlightedColor;
				colors.disabledColor = new Color32(110, 110, 110, 90);
				break;
			default:
				image.color = new Color32(255, 255, 255, 0);
				label.color = ShellMutedTextColor;
				outline.effectColor = new Color32(255, 255, 255, 0);
				colors.normalColor = Color.white;
				colors.highlightedColor = new Color32(255, 255, 255, 16);
				colors.pressedColor = new Color32(255, 255, 255, 10);
				colors.selectedColor = colors.highlightedColor;
				colors.disabledColor = new Color32(110, 110, 110, 90);
				break;
		}

		button.colors = colors;
	}

	private TMP_InputField CreateInputField(Transform parent, string name, string placeholder, bool isPassword)
	{
		var rect = CreateRectObject(name, parent);
		var layout = rect.gameObject.AddComponent<LayoutElement>();
		layout.minHeight = 74f;
		layout.preferredHeight = 74f;

		var background = rect.gameObject.AddComponent<Image>();
		background.sprite = controlUiSprite;
		background.type = Image.Type.Sliced;
		background.color = ShellInputColor;

		var outline = rect.gameObject.AddComponent<Outline>();
		outline.effectColor = ShellBorderColor;
		outline.effectDistance = new Vector2(1f, -1f);
		outline.useGraphicAlpha = true;

		var inputField = rect.gameObject.AddComponent<TMP_InputField>();
		inputField.lineType = TMP_InputField.LineType.SingleLine;
		inputField.richText = false;
		inputField.caretColor = ShellAccentColor;
		inputField.selectionColor = new Color32(ShellAccentSoftColor.r, ShellAccentSoftColor.g, ShellAccentSoftColor.b, 90);
		inputField.customCaretColor = true;
		inputField.text = string.Empty;
		inputField.contentType = isPassword ? TMP_InputField.ContentType.Password : TMP_InputField.ContentType.Standard;
		inputField.keyboardType = TouchScreenKeyboardType.Default;

		var viewport = CreateRectObject("Viewport", rect);
		viewport.anchorMin = Vector2.zero;
		viewport.anchorMax = Vector2.one;
		viewport.offsetMin = new Vector2(22f, 12f);
		viewport.offsetMax = new Vector2(isPassword ? -104f : -22f, -12f);
		var viewportMask = viewport.gameObject.AddComponent<RectMask2D>();
		viewportMask.padding = Vector4.zero;

		var text = CreateText("Text", viewport, string.Empty, 20f, FontStyles.Normal, ShellTextColor, TextAlignmentOptions.MidlineLeft);
		var textRect = text.rectTransform;
		textRect.anchorMin = Vector2.zero;
		textRect.anchorMax = Vector2.one;
		textRect.offsetMin = Vector2.zero;
		textRect.offsetMax = Vector2.zero;
		text.textWrappingMode = TextWrappingModes.NoWrap;

		var placeholderText = CreateText("Placeholder", viewport, placeholder, 20f, FontStyles.Normal, ShellFaintTextColor, TextAlignmentOptions.MidlineLeft);
		var placeholderRect = placeholderText.rectTransform;
		placeholderRect.anchorMin = Vector2.zero;
		placeholderRect.anchorMax = Vector2.one;
		placeholderRect.offsetMin = Vector2.zero;
		placeholderRect.offsetMax = Vector2.zero;
		placeholderText.textWrappingMode = TextWrappingModes.NoWrap;

		inputField.textViewport = viewport;
		inputField.textComponent = text as TextMeshProUGUI;
		inputField.placeholder = placeholderText;

		if (isPassword)
		{
			var toggleRect = CreateRectObject("VisibilityToggle", rect);
			toggleRect.anchorMin = new Vector2(1f, 0.5f);
			toggleRect.anchorMax = new Vector2(1f, 0.5f);
			toggleRect.pivot = new Vector2(1f, 0.5f);
			toggleRect.anchoredPosition = new Vector2(-12f, 0f);
			toggleRect.sizeDelta = new Vector2(78f, 40f);

			var toggleImage = toggleRect.gameObject.AddComponent<Image>();
			toggleImage.sprite = controlUiSprite;
			toggleImage.type = Image.Type.Sliced;
			toggleImage.color = new Color32(255, 255, 255, 10);

			var toggleOutline = toggleRect.gameObject.AddComponent<Outline>();
			toggleOutline.effectColor = new Color32(255, 255, 255, 16);
			toggleOutline.effectDistance = new Vector2(1f, -1f);
			toggleOutline.useGraphicAlpha = true;

			var toggleButton = toggleRect.gameObject.AddComponent<Button>();
			toggleButton.targetGraphic = toggleImage;

			var toggleLabel = CreateText("Label", toggleRect, "SHOW", 11f, FontStyles.Bold, ShellAccentSoftColor, TextAlignmentOptions.Center);
			Stretch(toggleLabel.rectTransform);
			toggleLabel.characterSpacing = 4f;

			var isVisible = false;
			toggleButton.onClick.AddListener(() =>
			{
				isVisible = !isVisible;
				inputField.contentType = isVisible ? TMP_InputField.ContentType.Standard : TMP_InputField.ContentType.Password;
				inputField.ForceLabelUpdate();
				toggleLabel.text = isVisible ? "HIDE" : "SHOW";
				FocusInputFieldNextFrame(inputField);
			});

			AddButtonMotion(toggleButton, 1.04f);
			RegisterSelectable(toggleButton);
		}

		RegisterSelectable(inputField);
		return inputField;
	}

	private static void ReplaceButtonHandler(Button button, Action handler)
	{
		if (button == null || handler == null)
		{
			return;
		}

		button.onClick = new Button.ButtonClickedEvent();
		button.onClick.AddListener(() => handler());
	}

	private static bool SupportsUnityPlayerAccountsSignIn()
	{
#if UNITY_WEBGL && !UNITY_EDITOR
		return false;
#else
		return true;
#endif
	}

	private void EnsureRuntimeSprites()
	{
		if (solidUiSprite != null && cardUiSprite != null && moduleUiSprite != null && controlUiSprite != null && orbUiSprite != null)
		{
			return;
		}

		solidUiSprite = CreateSolidSprite();
		cardUiSprite = CreateRoundedSprite("ShellCardSprite", 128, 28f, 36);
		moduleUiSprite = CreateRoundedSprite("ShellModuleSprite", 128, 22f, 28);
		controlUiSprite = CreateRoundedSprite("ShellControlSprite", 128, 18f, 24);
		orbUiSprite = CreateRoundedSprite("ShellOrbSprite", 128, 64f, 64);
	}

	private Sprite CreateSolidSprite()
	{
		var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false);
		texture.name = "SolidUiTexture";
		texture.wrapMode = TextureWrapMode.Clamp;
		texture.filterMode = FilterMode.Bilinear;

		var pixels = new Color32[4];
		for (var i = 0; i < pixels.Length; i++)
		{
			pixels[i] = new Color32(255, 255, 255, 255);
		}

		texture.SetPixels32(pixels);
		texture.Apply(false, true);

		var sprite = Sprite.Create(texture, new Rect(0f, 0f, texture.width, texture.height), new Vector2(0.5f, 0.5f), 100f);
		sprite.name = "SolidUiSprite";

		generatedUiAssets.Add(sprite);
		generatedUiAssets.Add(texture);
		return sprite;
	}

	private Sprite CreateRoundedSprite(string spriteName, int size, float radius, int border)
	{
		var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);
		texture.name = $"{spriteName}Texture";
		texture.wrapMode = TextureWrapMode.Clamp;
		texture.filterMode = FilterMode.Bilinear;

		var pixels = new Color32[size * size];
		var halfSize = size * 0.5f;
		var halfExtents = new Vector2(halfSize - radius, halfSize - radius);

		for (var y = 0; y < size; y++)
		{
			for (var x = 0; x < size; x++)
			{
				var point = new Vector2((x + 0.5f) - halfSize, (y + 0.5f) - halfSize);
				var q = new Vector2(Mathf.Abs(point.x), Mathf.Abs(point.y)) - halfExtents;
				var outside = new Vector2(Mathf.Max(q.x, 0f), Mathf.Max(q.y, 0f));
				var signedDistance = outside.magnitude + Mathf.Min(Mathf.Max(q.x, q.y), 0f) - radius;
				var alpha = Mathf.Clamp01(0.5f - signedDistance);
				pixels[(y * size) + x] = new Color32(255, 255, 255, (byte)Mathf.RoundToInt(alpha * 255f));
			}
		}

		texture.SetPixels32(pixels);
		texture.Apply(false, true);

		var sprite = Sprite.Create(
			texture,
			new Rect(0f, 0f, size, size),
			new Vector2(0.5f, 0.5f),
			100f,
			0,
			SpriteMeshType.FullRect,
			new Vector4(border, border, border, border)
		);
		sprite.name = spriteName;

		generatedUiAssets.Add(sprite);
		generatedUiAssets.Add(texture);
		return sprite;
	}

	private static void NotifyWebShellAuthEvent(string state, string message)
	{
#if UNITY_WEBGL && !UNITY_EDITOR
		try
		{
			UltraRapidShellNotifyAuthEvent(state ?? string.Empty, message ?? string.Empty);
		}
		catch (Exception ex)
		{
			Debug.LogWarning($"Failed to notify WebGL shell auth state: {ex.Message}");
		}
#endif
	}
}
