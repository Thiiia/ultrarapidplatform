using UnityEngine;
using UnityEngine.UI;

using LeTai.Asset.TranslucentImage;

using Sirenix.OdinInspector;

public partial class DragExecutionController
{
	private void ApplySceneBackgroundOverridesIfEnabled()
	{
		bool shouldApplyBackgroundCanvasLayering = forceBackgroundImageBehindGameplayCanvas;
		bool shouldAutoBind = autoFindSceneBackgroundReferences && (applySceneBackgroundOverrides || shouldApplyBackgroundCanvasLayering);

		if (shouldAutoBind)
		{
			TryAutoBindSceneBackgroundReferences();
		}

		if (sceneBackgroundImage != null && shouldApplyBackgroundCanvasLayering)
		{
			Canvas sourceCanvas = parentCanvas != null
				? parentCanvas
				: (equationContainer != null ? equationContainer.GetComponentInParent<Canvas>() : sceneBackgroundImage.GetComponentInParent<Canvas>());
			if (sourceCanvas != null)
			{
				Canvas bgCanvas = sceneBackgroundImage.GetComponent<Canvas>();
				if (bgCanvas == null)
				{
					bgCanvas = sceneBackgroundImage.gameObject.AddComponent<Canvas>();
				}

				bgCanvas.overrideSorting = true;
				bgCanvas.sortingLayerID = sourceCanvas.sortingLayerID;
				bgCanvas.sortingOrder = sourceCanvas.sortingOrder + Mathf.Clamp(sceneBackgroundCanvasSortingOffset, -50, -1);
			}
		}

		if (!applySceneBackgroundOverrides)
		{
			return;
		}

		if (sceneBackgroundImage != null)
		{
			sceneBackgroundImage.color = sceneBackgroundColor;
			if (clearSceneBackgroundSprite)
			{
				sceneBackgroundImage.sprite = null;
			}
		}

		if (sceneBackgroundCamera == null)
		{
			sceneBackgroundCamera = uiCamera != null ? uiCamera : Camera.main;
		}

		if (sceneBackgroundCamera != null)
		{
			sceneBackgroundCamera.backgroundColor = sceneBackgroundColor;
		}

		if (sceneFullscreenBackgroundOverlay != null)
		{
			bool sharedBackgroundObject = sceneBackgroundImage != null
				&& sceneFullscreenBackgroundOverlay.gameObject == sceneBackgroundImage.gameObject;
			bool shouldDisableOverlay = disableFullscreenBackgroundOverlay
				&& !(keepSharedTranslucentBackgroundEnabled && sharedBackgroundObject);

			sceneFullscreenBackgroundOverlay.gameObject.SetActive(!shouldDisableOverlay);

			if (sceneFullscreenBackgroundOverlay.gameObject.activeSelf && tuneSceneBackgroundTranslucentImage)
			{
				sceneFullscreenBackgroundOverlay.color = useSeparateTranslucentBackgroundTint
					? sceneBackgroundTranslucentTint
					: sceneBackgroundColor;
				sceneFullscreenBackgroundOverlay.foregroundOpacity = Mathf.Clamp01(sceneBackgroundTranslucentForegroundOpacity);
				sceneFullscreenBackgroundOverlay.brightness = sceneBackgroundTranslucentBrightness;
				sceneFullscreenBackgroundOverlay.vibrancy = sceneBackgroundTranslucentVibrancy;
				sceneFullscreenBackgroundOverlay.flatten = sceneBackgroundTranslucentFlatten;
			}
		}
	}

	private void TryAutoBindSceneBackgroundReferences()
	{
		if (sceneBackgroundImage == null)
		{
			Image[] images = FindObjectsByType<Image>(FindObjectsInactive.Include, FindObjectsSortMode.None);
			float bestArea = -1f;
			for (int i = 0; i < images.Length; i++)
			{
				Image img = images[i];
				if (img == null || img.name != "BackgroundImage")
				{
					continue;
				}

				RectTransform rt = img.rectTransform;
				if (rt == null)
				{
					continue;
				}

				float area = Mathf.Abs(rt.rect.width * rt.rect.height);
				if (area > bestArea)
				{
					bestArea = area;
					sceneBackgroundImage = img;
				}
			}
		}

		if (sceneFullscreenBackgroundOverlay == null)
		{
			TranslucentImage[] overlays = FindObjectsByType<TranslucentImage>(FindObjectsInactive.Include, FindObjectsSortMode.None);
			float bestArea = -1f;
			for (int i = 0; i < overlays.Length; i++)
			{
				TranslucentImage overlay = overlays[i];
				if (overlay == null || overlay.name != "BackgroundImage")
				{
					continue;
				}

				RectTransform rt = overlay.rectTransform;
				if (rt == null)
				{
					continue;
				}

				float area = Mathf.Abs(rt.rect.width * rt.rect.height);
				if (area > bestArea)
				{
					bestArea = area;
					sceneFullscreenBackgroundOverlay = overlay;
				}
			}
		}
	}

	[FoldoutGroup("Tools"), FoldoutGroup("Tools/Quick Actions"), Button("Apply Scene Background Overrides", ButtonSizes.Medium)]
	[ContextMenu("Apply Scene Background Overrides Now")]
	public void ApplySceneBackgroundOverridesNow()
	{
		ApplySceneBackgroundOverridesIfEnabled();
	}
}
