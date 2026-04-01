using UnityEngine;
using UnityEngine.UI;
using UnityEditor;
using static WFA.utilities.utilities0;

#if USING_URP
using UnityEngine.Rendering.Universal;
#endif
// WFA 2.0
namespace WFA
{
	public partial class WebGLFPSAccelerator : MonoBehaviour
	{
		public enum RenderPipeline
		{
			BRP,
			URP
		}

		public static WebGLFPSAccelerator _getInstance;
		public static WebGLFPSAccelerator getInstance
		{
			get
			{
				if (_getInstance == null)
				{
#if UNITY_2023_1_OR_NEWER
					WebGLFPSAccelerator webGLFPSAccelerator = FindFirstObjectByType<WebGLFPSAccelerator>();
#else
          WebGLFPSAccelerator webGLFPSAccelerator = FindObjectOfType<WebGLFPSAccelerator>();
#endif
					_getInstance = webGLFPSAccelerator;
				}

				return _getInstance;
			}
		}

		public static float textDPI
		{
			get
			{
				return mainData.textDPI;
			}
			set
			{
				float temp = mainData.textDPI;
				mainData.textDPI = value;

				if (mainData.textDPI == temp)
					return;

#if UNITY_EDITOR
				if (!Application.isPlaying)
					return;
#endif

				applyTextDPI();
			}
		}
		public static bool showUI
		{
			get
			{
				return mainData.showUI;
			}
			set
			{
				mainData.showUI = value;
			}
		}
		public static float fixedDPI
		{
			get
			{
				return WebGLFPSAccelerator.mainData.fixedDPI;
			}
			set
			{
				WebGLFPSAccelerator.mainData.fixedDPI = value;
			}
		}

		public Camera _targetCamera;
		public static Camera targetCamera
		{
			get
			{
				if (getInstance._targetCamera == null)
				{
					if (Camera.main)
						getInstance._targetCamera = Camera.main;
					else
						Debug.LogError("Please Select A Camera On Settings of webglFpsAcceleratorManager Object!");
				}

				return getInstance._targetCamera;
			}
			set
			{
				getInstance._targetCamera = value;
			}
		}

		public wfaConfig _mainData;
		public static wfaConfig mainData
		{
			get
			{
				if (WebGLFPSAccelerator.getInstance._mainData == null)
					WebGLFPSAccelerator.getInstance._mainData = Resources.Load<wfaConfig>("wfaConfigDefault");

				return WebGLFPSAccelerator.getInstance._mainData;
			}
			set
			{
				WebGLFPSAccelerator.getInstance._mainData = value;
				Debug.Log("WFA config data is changed");
			}
		}

		public static RenderPipeline renderPipeline;
		public static renderScale _renderScale;
		private static bool isInBackground;

#if USING_URP
		private UniversalRenderPipelineAsset _urpAsset;
		public UniversalRenderPipelineAsset urpAsset
		{
			get
			{
				if (_urpAsset)
					return _urpAsset;

				var rpAsset = UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline;
				_urpAsset = (UniversalRenderPipelineAsset)rpAsset;
				return _urpAsset;
			}
			set
			{
				_urpAsset = value;
			}
		}
#endif

#if UNITY_WEBGL && !UNITY_EDITOR
    [System.Runtime.InteropServices.DllImport("__Internal")]
    private static extern float getDefaultDPR();

    [System.Runtime.InteropServices.DllImport("__Internal")]
    private static extern void _setDPR(float float1);

    [System.Runtime.InteropServices.DllImport("__Internal")]
    private static extern void checkVisibility();
#endif

		public static void requestDefaultDPR()
		{
#if UNITY_WEBGL && !UNITY_EDITOR
      DPI.defaultDPR = getDefaultDPR();
#endif
		}

		void init()
		{
#if UNITY_WEBGL && !UNITY_EDITOR
      checkVisibility();
#endif

#if USING_URP
			renderPipeline = RenderPipeline.URP;
#endif

			downSamplingSystem.prepare();
			resolutionSystem.prepare();

#if UNITY_EDITOR
			if (showUI)
				if (EditorApplication.isPlaying)
				{
					runAfterXFrame(15, () =>
					{
						wfaUI.show();
					});
				}
#else
        if (showUI)
        {
          runAfterXFrame(15, () =>
          {
            wfaUI.show();
          });
        }
#endif
		}

		void Awake()
		{
			print("WFA 2.0");

			Application.targetFrameRate = 300;

#if UNITY_EDITOR
			EditorApplication.playModeStateChanged += playModeStateChanged;
#endif

			applyTextDPI();
		}

		void Update()
		{
			counter(GetInstanceID(), "Update", out int counter0);
			if (counter0 < 15)
				return;
			else if (counter0 == 15)
			{
				init();
				return;
			}

			run();
		}

#if UNITY_EDITOR
		public void playModeStateChanged(PlayModeStateChange state)
		{
			if (state == PlayModeStateChange.EnteredEditMode)
			{
				downSamplingSystem.removeRenderScaleSystem();
			}
		}
#endif

		public static void applyTextDPI()
		{
#if UNITY_2023_1_OR_NEWER
			Text[] list = FindObjectsByType<Text>(UnityEngine.FindObjectsSortMode.None);
#else
      Text[] list = FindObjectsOfType<Text>();
#endif
			foreach (Text obj in list)
			{
				//obj.textDPI = textDPI;
				//obj.wfaDPI = DPI.value;
				obj.SetAllDirty();
			}
		}

		public static void run()
		{
			switch (resolutionSystem.current)
			{
				case resolutionSystem._enum.dynamicResolutionSystem:
					if (isInBackground)
						break;

					resolutionSystem.dynamicResolutionSystem.run();
					break;
				case resolutionSystem._enum.fixedResolutionSystem:
					resolutionSystem.fixedResolutionSystem.run();
					break;
			}
		}

		public static class resolutionSystem
		{
			public static class dynamicResolutionSystem
			{
				public static class fpsCounter
				{
					public static int fps;
					private static int fpsAccumulator;
					private static float nextPeriod;

					public static float measurePeriod
					{
						get
						{
							return WebGLFPSAccelerator.mainData.measurePeriod;
						}
						set
						{
							WebGLFPSAccelerator.mainData.measurePeriod = value;
						}
					}

					public static bool getAverageFPS()
					{
						fpsAccumulator++;

						if (Time.realtimeSinceStartup >= nextPeriod)
						{
							fps = (int)(fpsAccumulator / measurePeriod);
							refresh();

							return true;
						}
						else
						{
							return false;
						}
					}

					public static void refresh()
					{
						nextPeriod = Time.realtimeSinceStartup + measurePeriod;
						fpsAccumulator = 0;
					}
				}

				public static float dpiDecrement
				{
					get
					{
						return WebGLFPSAccelerator.mainData.dpiDecrement;
					}
					set
					{
						WebGLFPSAccelerator.mainData.dpiDecrement = value;
					}
				}

				public static float dpiIncrement
				{
					get
					{
						return WebGLFPSAccelerator.mainData.dpiIncrement;
					}
					set
					{
						WebGLFPSAccelerator.mainData.dpiIncrement = value;
					}
				}

				public static int fpsMin
				{
					get
					{
						return WebGLFPSAccelerator.mainData.fpsMin;
					}
					set
					{
						WebGLFPSAccelerator.mainData.fpsMin = value;
					}
				}

				public static int fpsMax
				{
					get
					{
						return WebGLFPSAccelerator.mainData.fpsMax;
					}
					set
					{
						WebGLFPSAccelerator.mainData.fpsMax = value;
					}
				}

				public static float dpiMin
				{
					get
					{
						return WebGLFPSAccelerator.mainData.dpiMin;
					}
					set
					{
						WebGLFPSAccelerator.mainData.dpiMin = value;
					}
				}

				public static float dpiMax
				{
					get
					{
						return WebGLFPSAccelerator.mainData.dpiMax;
					}
					set
					{
						WebGLFPSAccelerator.mainData.dpiMax = value;
					}
				}

				public static void prepare()
				{
					fpsCounter.refresh();
				}

				public static void run()
				{
					if (!fpsCounter.getAverageFPS())
						return;

					if (fpsCounter.fps > fpsMax)
					{
						DPI.value += dpiIncrement;
					}
					else if (fpsCounter.fps < fpsMin)
					{
						DPI.value -= dpiDecrement;
					}
				}
			}

			public static class fixedResolutionSystem
			{
				public static void run()
				{
					if (downSamplingSystem.current == downSamplingSystem._enum.renderScale)
					{
						DPI.value = WebGLFPSAccelerator.fixedDPI;
					}
					else
					{
						if (Time.frameCount % 50 == 0)
							DPI.value = WebGLFPSAccelerator.fixedDPI;
					}
				}

				public static void prepare()
				{
				}
			}

			public enum _enum
			{
				dynamicResolutionSystem,
				fixedResolutionSystem
			}

			public static _enum current
			{
				get
				{
					return WebGLFPSAccelerator.mainData.resolutionSystem;
				}
				set
				{
					if (WebGLFPSAccelerator.mainData.resolutionSystem != value)
					{
						WebGLFPSAccelerator.mainData.resolutionSystem = value;

#if UNITY_EDITOR
						if (!Application.isPlaying)
							return;
#endif

						prepare();
					}
				}
			}

			public static void prepare()
			{
				switch (current)
				{
					case _enum.dynamicResolutionSystem:
						dynamicResolutionSystem.prepare();
						break;
					case _enum.fixedResolutionSystem:
						fixedResolutionSystem.prepare();
						break;
				}
			}
		}

		public static class downSamplingSystem
		{
			public enum _enum
			{
				renderScale,
				devicePixelRatio
			}

			public static _enum current
			{
				get
				{
					return WebGLFPSAccelerator.mainData.downSamplingSystem;
				}
				set
				{
					if (WebGLFPSAccelerator.mainData.downSamplingSystem != value)
					{
						WebGLFPSAccelerator.mainData.downSamplingSystem = value;

#if UNITY_EDITOR
						if (!Application.isPlaying)
							return;
#endif

						prepare();
					}
				}
			}

			public static void prepare()
			{
				switch (current)
				{
					case _enum.renderScale:
						prepareRenderScaleSystem();
						break;
					case _enum.devicePixelRatio:
						prepareDPRSystem();
						break;
				}
			}

			public static void checkDefaultDPR()
			{
				if (DPI.defaultDPR == 0)
					requestDefaultDPR();
			}

			public static void removeRenderScaleSystem()
			{
				switch (WebGLFPSAccelerator.renderPipeline)
				{
					case RenderPipeline.BRP:
						if (WebGLFPSAccelerator._renderScale)
						{
							WebGLFPSAccelerator._renderScale.resetDPI();

#if UNITY_EDITOR
							if (EditorApplication.isPlaying)
							{
								Destroy(WebGLFPSAccelerator._renderScale);
							}
							else
							{
								DestroyImmediate(WebGLFPSAccelerator._renderScale);
							}
#else
              Destroy(WebGLFPSAccelerator._renderScale);
#endif
						}
						break;
					case RenderPipeline.URP:
#if USING_URP
						DPI.Set(downSamplingSystem._enum.renderScale, 1);
#endif
						break;
				}
			}

			public static void prepareDPRSystem()
			{
				removeRenderScaleSystem();
				checkDefaultDPR();
				DPI.resetDPI();
			}

			public static void prepareRenderScaleSystem()
			{
				if (DPI.defaultDPR != 0)
					DPI.Set(downSamplingSystem._enum.devicePixelRatio, 1);

				switch (renderPipeline)
				{
					case RenderPipeline.URP:
						prepareURPRenderScale();
						break;
					case RenderPipeline.BRP:
						prepareDefaultRenderScale();
						break;
				}

				DPI.resetDPI();
			}

			public static void prepareURPRenderScale()
			{
			}

			public static void prepareDefaultRenderScale()
			{
				if (WebGLFPSAccelerator._renderScale == null)
				{
					if (WebGLFPSAccelerator.targetCamera.gameObject.GetComponent<renderScale>() == null)
					{
						WebGLFPSAccelerator._renderScale = WebGLFPSAccelerator.targetCamera.gameObject.AddComponent<renderScale>();
					}
					else
					{
						WebGLFPSAccelerator._renderScale = WebGLFPSAccelerator.targetCamera.gameObject.GetComponent<renderScale>();
					}
				}
			}
		}

		public static class DPI
		{
			public static float value
			{
				get
				{
					return WebGLFPSAccelerator.mainData.DPI;
				}
				set
				{
					float lastValue = WebGLFPSAccelerator.mainData.DPI;
					WebGLFPSAccelerator.mainData.DPI = value;

					if (lastValue != WebGLFPSAccelerator.mainData.DPI)
					{
#if UNITY_EDITOR
						if (!Application.isPlaying)
							return;
#endif

						ApplyDPI();
					}
				}
			}

			public static float defaultDPR;

			private static void ApplyDPI()
			{
				DPI.Set(downSamplingSystem.current, value);
			}
			public static void Set(downSamplingSystem._enum downSamplingSystem, float dpi)
			{
				switch (downSamplingSystem)
				{
					case WebGLFPSAccelerator.downSamplingSystem._enum.renderScale:
						switch (WebGLFPSAccelerator.renderPipeline)
						{
							case RenderPipeline.BRP:
								setDPI_DefaultRenderScale(dpi);
								break;
							case RenderPipeline.URP:
								setDPI_URPRenderScale(dpi);
								break;
						}
						break;
					case WebGLFPSAccelerator.downSamplingSystem._enum.devicePixelRatio:
						setDPI_DPR(dpi);
						break;
				}
			}

			public static void resetDPI()
			{
				switch (resolutionSystem.current)
				{
					case resolutionSystem._enum.dynamicResolutionSystem:
						DPI.value = 1;
						break;
					case resolutionSystem._enum.fixedResolutionSystem:
						WebGLFPSAccelerator.fixedDPI = 1;
						DPI.value = 1;
						break;
				}
			}

			public static void setDPI_DPR(float dpi)
			{
				__setDPR(dpi * DPI.defaultDPR);
			}
			private static void setDPI_URPRenderScale(float dpi)
			{
#if USING_URP
				WebGLFPSAccelerator.getInstance.urpAsset.renderScale = dpi;
#endif
			}

			private static void setDPI_DefaultRenderScale(float dpi)
			{
				WebGLFPSAccelerator._renderScale.setDPI(dpi);
			}

			public static void __setDPR(float float1)
			{
#if UNITY_WEBGL && !UNITY_EDITOR
        _setDPR(float1);
#endif
			}
		}

		#region Utils
		public void OnApplicationIsInBackground()
		{
			isInBackground = true;
		}

		public void OnApplicationIsNotInBackground()
		{
			isInBackground = false;
		}
		#endregion
	}
}
