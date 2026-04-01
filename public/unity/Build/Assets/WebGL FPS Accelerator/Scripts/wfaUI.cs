using System.Collections.Generic;
using UnityEngine;
using static WFA.WebGLFPSAccelerator;
using static WFA.utilities.runtimeInspector;
using WFA.utilities;
using Object = UnityEngine.Object;
// WFA 2.0
namespace WFA
{
  public static class wfaUI  {
    public static void show()
    {
#if UNITY_EDITOR
      if (!UnityEditor.EditorApplication.isPlaying)
        return;
#endif

      Object _original = Resources.Load(path: "webglFpsAcceleratorInGameUICanvas");
      GameObject GameObject0 = (GameObject)UnityEngine.Object.Instantiate
      (
        original: _original,
        parent: GameObject.Find(name: "webglFpsAcceleratorPrefab").transform
      );
      panel = GameObject0.transform.GetChild(index: 0);

#if UNITY_EDITOR
      UnityEditor.EditorApplication.playModeStateChanged +=
        EditorApplication_playModeStateChanged;
#endif

      dropDown
      (
        label: "downSamplingSystem",
        targetObject: typeof(WebGLFPSAccelerator.interFace),
        propertyName: "downSamplingSystem",
        enumType: typeof(downSamplingSystem._enum),
        memberType: serializer.MemberType.property
      );

      dropDown
      (
        label: "resolutionSystem",
        targetObject: typeof(WebGLFPSAccelerator.interFace),
        propertyName: "resolutionSystem",
        enumType: typeof(resolutionSystem._enum),
        memberType: serializer.MemberType.property
      );

      inputManager inputManager0 = null;

      inputManager0 = dropDown
      (
        label: "FilterMode",
        targetObject: typeof(WebGLFPSAccelerator.interFace),
        propertyName: "filterMode",
        enumType: typeof(FilterMode),
        memberType: serializer.MemberType.property
      );

      inputManager0.isVisible_If = () =>
      downSamplingSystem.current == downSamplingSystem._enum.renderScale;

      inputManager0 = slider
      (
        label: "DPI",
        targetObject: typeof(WebGLFPSAccelerator.interFace),
        propertyName: "fixedDPI",
        minSliderValue: 0.3f,
        maxSliderValue: 1,
        memberType: serializer.MemberType.property
      );

      inputManager0.isVisible_If = () =>
        !(resolutionSystem.current == resolutionSystem._enum.dynamicResolutionSystem);

      createDRSparameters();

      slider
      (
        label: "textDPI",
        targetObject: typeof(WebGLFPSAccelerator.interFace),
        propertyName: "textDPI",
        minSliderValue: 0.5f,
        maxSliderValue: 4,
        memberType: serializer.MemberType.property
      );
    }

    private static void createDRSparameters()
    {
      List<inputManager> inputManagerL0 = new List<inputManager>();

      inputManagerL0.Add(item: ReadOnlyField
      (
        label: "DPI",
        targetObject: typeof(WebGLFPSAccelerator.interFace),
        propertyName: "DPI",
        memberType: serializer.MemberType.property
        ));

      inputManagerL0.Add
      (
        item:
          InputField
          (
            label: "fpsMin",
            targetObject: typeof(WebGLFPSAccelerator.interFace),
            propertyName: "fpsMin",
            memberType: serializer.MemberType.property
          )
      );

      inputManagerL0.Add(item: InputField
      (
        label: "fpsMax",
        targetObject: typeof(WebGLFPSAccelerator.interFace),
        propertyName: "fpsMax",
        memberType: serializer.MemberType.property
      ));

      inputManagerL0.Add
      (
        item: InputField
        (
          label: "dpiIncreament",
          targetObject: typeof(WebGLFPSAccelerator.interFace),
          propertyName: "dpiIncrement",
          memberType: serializer.MemberType.property
        )
      );

      inputManagerL0.Add
      (
        item: InputField
        (
          label: "dpiDecrement",
          targetObject: typeof(WebGLFPSAccelerator.interFace),
          propertyName: "dpiDecrement",
          memberType: serializer.MemberType.property
        )
      );

      inputManagerL0.Add
      (
        item: InputField
        (
          label: "measurePeriod",
          targetObject: typeof(WebGLFPSAccelerator.interFace),
          propertyName: "measurePeriod",
          memberType: serializer.MemberType.property
        )
      );

      inputManagerL0.Add
      (
        item: InputField
        (
          label: "dpiMax",
          targetObject: typeof(WebGLFPSAccelerator.interFace),
          propertyName: "dpiMax",
          memberType: serializer.MemberType.property
        )
      );

      inputManagerL0.Add
      (
        item: InputField
        (
          label: "dpiMin",
          targetObject: typeof(WebGLFPSAccelerator.interFace),
          propertyName: "dpiMin",
          memberType: serializer.MemberType.property
        )
      );

      inputManagerL0.ForEach(action: (i) =>
      {
        i.isVisible_If = () =>
        resolutionSystem.current == resolutionSystem._enum.dynamicResolutionSystem;
      });
    }

#if UNITY_EDITOR
    private static void EditorApplication_playModeStateChanged(UnityEditor.PlayModeStateChange obj)
    {
      switch (obj)
      {
        case UnityEditor.PlayModeStateChange.EnteredEditMode:
          break;
        case UnityEditor.PlayModeStateChange.ExitingEditMode:
          break;
        case UnityEditor.PlayModeStateChange.EnteredPlayMode:
          break;
        case UnityEditor.PlayModeStateChange.ExitingPlayMode:
          UnityEngine.Object.Destroy(obj: panel);
          break;
        default:
          break;
      }
    }
#endif
  }
}