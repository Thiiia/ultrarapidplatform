using System;
using System.Reflection;

using UnityEngine;

using TMPro;

using DG.Tweening;

public partial class DragExecutionController
{
	private static Type cachedTextAnimatorType;
	private static bool cachedTextAnimatorTypeResolved;
	private static PropertyInfo cachedTextAnimatorTimeScaleProperty;
	private static PropertyInfo cachedTextAnimatorAutoStartProperty;
	private static MethodInfo cachedTextAnimatorSetTextMethod;

	private static Type ResolveTextAnimatorType()
	{
		if (cachedTextAnimatorTypeResolved)
		{
			return cachedTextAnimatorType;
		}

		cachedTextAnimatorTypeResolved = true;
		cachedTextAnimatorType = Type.GetType("Febucci.UI.TextAnimator_TMP, Febucci.TextAnimator")
			?? Type.GetType("Febucci.UI.TextAnimator_TMP");
		if (cachedTextAnimatorType != null)
		{
			CacheTextAnimatorMembers(cachedTextAnimatorType);
			return cachedTextAnimatorType;
		}

		Assembly[] assemblies = AppDomain.CurrentDomain.GetAssemblies();
		for (int i = 0; i < assemblies.Length; i++)
		{
			Type found = assemblies[i].GetType("Febucci.UI.TextAnimator_TMP", throwOnError: false);
			if (found != null)
			{
				cachedTextAnimatorType = found;
				CacheTextAnimatorMembers(found);
				break;
			}
		}

		return cachedTextAnimatorType;
	}

	private static void CacheTextAnimatorMembers(Type animatorType)
	{
		if (animatorType == null)
		{
			cachedTextAnimatorTimeScaleProperty = null;
			cachedTextAnimatorAutoStartProperty = null;
			cachedTextAnimatorSetTextMethod = null;
			return;
		}

		const BindingFlags flags = BindingFlags.Instance | BindingFlags.Public;
		cachedTextAnimatorTimeScaleProperty = animatorType.GetProperty("timeScale", flags);
		cachedTextAnimatorAutoStartProperty = animatorType.GetProperty("typewriterStartsAutomatically", flags);
		cachedTextAnimatorSetTextMethod = animatorType.GetMethod("SetText", flags, binder: null, types: new[] { typeof(string) }, modifiers: null);
	}

	private static Component GetTextAnimator(TextMeshProUGUI tmp)
	{
		if (tmp == null)
		{
			return null;
		}

		Type animatorType = ResolveTextAnimatorType();
		return animatorType != null ? tmp.GetComponent(animatorType) : null;
	}

	private static Component EnsureTextAnimator(TextMeshProUGUI tmp)
	{
		if (tmp == null)
		{
			return null;
		}

		Type animatorType = ResolveTextAnimatorType();
		if (animatorType == null)
		{
			return null;
		}

		Component animator = tmp.GetComponent(animatorType);
		if (animator == null)
		{
			animator = tmp.gameObject.AddComponent(animatorType);
		}

		ConfigureTextAnimatorDefaults(animator, tmp.text);
		return animator;
	}

	private static void ConfigureTextAnimatorDefaults(Component animator, string currentText)
	{
		if (animator == null)
		{
			return;
		}

		if (cachedTextAnimatorTimeScaleProperty != null
			&& cachedTextAnimatorTimeScaleProperty.CanWrite
			&& cachedTextAnimatorTimeScaleProperty.PropertyType.IsEnum)
		{
			try
			{
				object unscaled = Enum.Parse(cachedTextAnimatorTimeScaleProperty.PropertyType, "Unscaled", ignoreCase: true);
				cachedTextAnimatorTimeScaleProperty.SetValue(animator, unscaled, index: null);
			}
			catch
			{
				// Keep defaults if this Febucci version exposes a different enum surface.
			}
		}

		if (cachedTextAnimatorAutoStartProperty != null
			&& cachedTextAnimatorAutoStartProperty.CanWrite
			&& cachedTextAnimatorAutoStartProperty.PropertyType == typeof(bool))
		{
			try
			{
				cachedTextAnimatorAutoStartProperty.SetValue(animator, false, index: null);
			}
			catch
			{
				// Keep defaults if the property isn't writable in this version.
			}
		}

		TrySetTextAnimatorText(animator, currentText);
	}

	private static void TrySetTextAnimatorText(Component animator, string text)
	{
		if (animator == null)
		{
			return;
		}

		if (cachedTextAnimatorSetTextMethod == null)
		{
			CacheTextAnimatorMembers(animator.GetType());
		}

		if (cachedTextAnimatorSetTextMethod == null)
		{
			return;
		}

		try
		{
			cachedTextAnimatorSetTextMethod.Invoke(animator, new object[] { text ?? string.Empty });
		}
		catch
		{
			// Fallback path is stable plain TMP text.
		}
	}

	private static void DestroyTextAnimator(TextMeshProUGUI tmp)
	{
		Component animator = GetTextAnimator(tmp);
		if (animator != null)
		{
			UnityEngine.Object.Destroy(animator);
		}
	}

	private static void DestroyTextAnimatorsRecursive(GameObject root)
	{
		if (root == null)
		{
			return;
		}

		Type animatorType = ResolveTextAnimatorType();
		if (animatorType == null)
		{
			return;
		}

		Component[] animators = root.GetComponentsInChildren(animatorType, true);
		for (int i = 0; i < animators.Length; i++)
		{
			if (animators[i] != null)
			{
				UnityEngine.Object.Destroy(animators[i]);
			}
		}
	}

	private static void TryDisableTextAnimator(TextMeshProUGUI tmp)
	{
		Component animator = GetTextAnimator(tmp);
		if (animator == null)
		{
			return;
		}

		DOTween.Kill(animator, complete: false);
		if (animator is Behaviour behaviour)
		{
			behaviour.enabled = false;
		}
	}
}
