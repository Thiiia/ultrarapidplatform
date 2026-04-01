using UnityEngine;
// WFA 2.0
namespace WFA
{
  public partial class WebGLFPSAccelerator
  {
    public static class interFace
    {
      /// <summary>
      /// For example, if this value is 2, per 2 seconds, WFA changes image
      /// resolution according to the average FPS of the last 2 seconds if it is necessary.
      /// </summary>
      public static float measurePeriod
      {
        get
        {
          return WebGLFPSAccelerator.resolutionSystem.dynamicResolutionSystem.fpsCounter.measurePeriod;
        }
        set
        {
          WebGLFPSAccelerator.resolutionSystem.dynamicResolutionSystem.fpsCounter.measurePeriod = value;
        }
      }


      /// <summary>
      /// Controls the speed of DPI-image resolution increase, which occurs when
      /// FPS are above the fpsMax parameter.
      /// </summary>
      public static float dpiDecrement
      {
        get
        {
          return WebGLFPSAccelerator.resolutionSystem.dynamicResolutionSystem.dpiDecrement;
        }
        set
        {
          WebGLFPSAccelerator.resolutionSystem.dynamicResolutionSystem.dpiDecrement = value;
        }
      }

      /// <summary>
      /// Controls the speed of DPI-image resolution decrease, which occurs
      /// when FPS are below the fpsMin parameter.
      /// </summary>
      public static float dpiIncrement
      {
        get
        {
          return WebGLFPSAccelerator.resolutionSystem.dynamicResolutionSystem.dpiIncrement;
        }
        set
        {
          WebGLFPSAccelerator.resolutionSystem.dynamicResolutionSystem.dpiIncrement = value;
        }
      }

      /// <summary>
      /// this setting allows you to decide the maximum image resolution.
      /// </summary>
      public static float dpiMax
      {
        get
        {
          return WebGLFPSAccelerator.resolutionSystem.dynamicResolutionSystem.dpiMax;
        }
        set
        {
          WebGLFPSAccelerator.resolutionSystem.dynamicResolutionSystem.dpiMax = value;
        }
      }

      /// <summary>
      /// this setting allows you to decide the minimum image resolution.
      /// </summary>
      public static float dpiMin
      {
        get
        {
          return WebGLFPSAccelerator.resolutionSystem.dynamicResolutionSystem.dpiMin;
        }
        set
        {
          WebGLFPSAccelerator.resolutionSystem.dynamicResolutionSystem.dpiMin = value;
        }
      }

      /// <summary>
      /// Your desired target FPS range.
      /// </summary>
      public static int fpsMax
      {
        get
        {
          return WebGLFPSAccelerator.resolutionSystem.dynamicResolutionSystem.fpsMax;
        }
        set
        {
          WebGLFPSAccelerator.resolutionSystem.dynamicResolutionSystem.fpsMax = value;
        }
      }

      /// <summary>
      /// Your desired target FPS range.
      /// </summary>
      public static int fpsMin
      {
        get
        {
          return WebGLFPSAccelerator.resolutionSystem.dynamicResolutionSystem.fpsMin;
        }
        set
        {
          WebGLFPSAccelerator.resolutionSystem.dynamicResolutionSystem.fpsMin = value;
        }
      }

      /// <summary>
      /// If "dynamicResolutionSystem" option is selected then you can choose the desired
      /// FPS range and WFA will dynamically adjust DPI-resolution to match the best FPS
      /// according to the DPI range specified.
      /// </summary>
      public static resolutionSystem._enum resolutionSystem
      {
        get
        {
          return WebGLFPSAccelerator.resolutionSystem.current;
        }
        set
        {
          WebGLFPSAccelerator.resolutionSystem.current = value;
        }
      }

      /// <summary>
      /// RenderScale: If the project is using Universal Render Pipeline, then WFA will use the
      /// “Render Scale” parameter of the render pipeline to adjust resolution. An advantage of
      /// this method is that downsampling does not affect the UI objects. If the project is using
      /// Built-in Render Pipeline, then WFA will use its own “Render Scale” parameter to adjust
      /// resolution.
      /// 
      /// devicePixelRatio: The down sampling system which is using devicePixelRatio
      /// parameter of the browser.
      /// </summary>
      public static downSamplingSystem._enum downSamplingSystem
      {
        get
        {
          return WebGLFPSAccelerator.downSamplingSystem.current;
        }
        set
        {
          WebGLFPSAccelerator.downSamplingSystem.current = value;
        }
      }

      /// <summary>
      /// Current DPI value
      /// </summary>
      public static float DPI
      {
        get
        {
          return WebGLFPSAccelerator.DPI.value;
        }
      }

      /// <summary>
      /// Current image resolution.If “dynamicResolutionSystem” is False,
      /// then you can set this value to catch your desired FPS.
      /// </summary>
      public static float fixedDPI
      {
        get
        {
          return WebGLFPSAccelerator.fixedDPI;
        }
        set
        {
          WebGLFPSAccelerator.fixedDPI = value;
        }
      }

      /// <summary>
      /// The target camera WFA will use for “Render Scale Down Sampling
      /// System” for built-in render pipeline.
      /// </summary>
      public static Camera targetCamera
      {
        get
        {
          return WebGLFPSAccelerator.targetCamera;
        }
        set
        {
          WebGLFPSAccelerator.targetCamera = value;
        }
      }

      /// <summary>
      /// Use this parameter if you want to adjust Text Resolution. (it does not work with
      /// Text Mesh Pro)
      /// </summary>
      public static float textDPI
      {
        get
        {
          return WebGLFPSAccelerator.textDPI;
        }
        set
        {
          WebGLFPSAccelerator.textDPI = value;
        }
      }

      /// <summary>
      /// Make this “true” if you want to use in-game UI to adjust parameters of WFA.
      /// IF IT IS “FALSE”, THE UI WILL NEVER BE CREATED AND ANY CODE WILL WORK ABOUT THIS.
      /// So you don’t need to worry about performance issues.
      /// </summary>
      public static bool showUI
      {
        get
        {
          return WebGLFPSAccelerator.showUI;
        }
        set
        {
          WebGLFPSAccelerator.showUI = value;
        }
      }

      /// <summary>
      /// WFA uses a “Configuration Data” which allows users to configure WFA
      /// parameters.by default WFA uses “wfaConfigDefault.asset” file in “Resources” directory.
      /// You can create your own Config Data; “Assets > Create > Wfa Config” then you should
      /// put it to this parameter(“MainData”);
      /// </summary>
      public static wfaConfig mainData
      {
        get
        {
          return WebGLFPSAccelerator.mainData;
        }
        set
        {
          WebGLFPSAccelerator.mainData = value;
        }
      }

      public static FilterMode filterMode
      {
        get => WebGLFPSAccelerator.mainData.filterMode;
        set => WebGLFPSAccelerator.mainData.filterMode = value;
      }
    }
  }
}