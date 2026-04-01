// Copyright (c) Le Loc Tai <leloctai.com> . All rights reserved. Do not redistribute.

using System;
using System.Collections.Generic;
using LeTai.Asset.TranslucentImage;
using LeTai.Common;
using TMPro;
using UnityEngine;
using UnityEngine.Serialization;
using UnityEngine.UI;

namespace LeTai.Paraform.Demo
{
public class DemoControllerContrast : MonoBehaviour
{
    public RectTransform    contrastGroup;
    public TinyTween.Spring springSwap = TinyTween.Spring.DEFAULT;

    public TinyTween.Spring springExit = TinyTween.Spring.DEFAULT;

    public TranslucentImage btnTemplateA;
    public TranslucentImage btnTemplateB;

    public float blurSmall               = 1f;
    public float blurLingerDurationSmall = 1f;
    public float blurLarge               = 50f;
    public float blurLingerDurationLarge = 1f;

    DemoControllerPresets presets;

    RectTransform    _floaterA;
    RectTransform    _floaterB;
    TranslucentImage _btnSwap;
    TextMeshProUGUI  _btnSwapTxt;

    Vector2 _restPos;
    Vector3 _posA;
    Vector3 _posB;
    Color   _fgColA;
    Color   _fgColB;

    bool  _isNotSwapped         = true; // logic is already backward :( changing the name is less work than changing the logic
    bool  _isInView             = false;
    bool  _isTargetingLargeBlur = false;
    float lastBlurChangeTime    = float.NegativeInfinity;

    RectTransform canvasRt;
    float         ExitOffset => -canvasRt.rect.height * 1.2f;

    void Start()
    {
        presets = FindAnyObjectByType<DemoControllerPresets>();

        _floaterA   = (RectTransform)contrastGroup.GetChild(0).transform;
        _floaterB   = (RectTransform)contrastGroup.GetChild(1).transform;
        _btnSwap    = contrastGroup.GetComponentInChildren<Button>().GetComponent<TranslucentImage>();
        _btnSwapTxt = _btnSwap.GetComponentInChildren<TextMeshProUGUI>();

        _restPos = contrastGroup.anchoredPosition;
        _posA    = _floaterA.anchoredPosition;
        _posB    = _floaterB.anchoredPosition;

        _fgColA = btnTemplateA.GetComponentInChildren<TextMeshProUGUI>().color;
        _fgColB = btnTemplateB.GetComponentInChildren<TextMeshProUGUI>().color;

        ApplySwapBtnAppearance();

        canvasRt = (RectTransform)GetComponentInParent<Canvas>().transform;

        contrastGroup.anchoredPosition = new Vector2(contrastGroup.anchoredPosition.x, ExitOffset);
        contrastGroup.gameObject.SetActive(true);

        var scrollSpyMarker = GetComponent<ScrollSpyMarker>();
        scrollSpyMarker.onActivated.AddListener(OnScrolledTo);
        scrollSpyMarker.onDeactivated.AddListener(OnScrolledAway);
    }

    void OnDestroy()
    {
        var scrollSpyMarker = GetComponent<ScrollSpyMarker>();
        scrollSpyMarker.onActivated.RemoveListener(OnScrolledTo);
        scrollSpyMarker.onDeactivated.RemoveListener(OnScrolledAway);
    }


    public void OnScrolledTo()
    {
        _isInView = true;
    }

    public void OnScrolledAway()
    {
        _isInView = false;
        presets.ApplyActiveMaterialPreset();
    }

    void Update()
    {
        if (_isInView)
        {
            float lingerDuration = _isTargetingLargeBlur ? blurLingerDurationSmall : blurLingerDurationLarge;
            if (lastBlurChangeTime + lingerDuration + springSwap.approxDuration < Time.time)
            {
                var targetBlur = _isTargetingLargeBlur ? blurLarge : blurSmall;
                presets.SetBlur(targetBlur);

                _isTargetingLargeBlur = !_isTargetingLargeBlur;
                lastBlurChangeTime    = Time.time;
            }
        }
    }

    public void Swap()
    {
        _isNotSwapped = !_isNotSwapped;

        var targetA = _isNotSwapped ? _posA : _posB;
        var targetB = _isNotSwapped ? _posB : _posA;
        TinyTween.Move(_floaterA, targetA, springSwap);
        TinyTween.Move(_floaterB, targetB, springSwap);

        ApplySwapBtnAppearance();
    }

    void ApplySwapBtnAppearance()
    {
        _btnSwap.material          = _isNotSwapped ? btnTemplateA.material : btnTemplateB.material;
        _btnSwap.foregroundOpacity = _isNotSwapped ? btnTemplateA.foregroundOpacity : btnTemplateB.foregroundOpacity;
        _btnSwap.vibrancy          = _isNotSwapped ? btnTemplateA.vibrancy : btnTemplateB.vibrancy;
        _btnSwap.brightness        = _isNotSwapped ? btnTemplateA.brightness : btnTemplateB.brightness;
        _btnSwap.flatten           = _isNotSwapped ? btnTemplateA.flatten : btnTemplateB.flatten;
        _btnSwapTxt.color          = _isNotSwapped ? _fgColA : _fgColB;
    }

    public void AnimateIn()
    {
        TinyTween.Move(contrastGroup, _restPos, springExit);
    }

    public void AnimateOut()
    {
        TinyTween.Move(contrastGroup, new Vector2(contrastGroup.anchoredPosition.x, _restPos.y + ExitOffset), springExit);
    }
}
}
