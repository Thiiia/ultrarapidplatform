using UnityEngine;
using Sirenix.OdinInspector;
using System.Collections;
using System.Collections.Generic;

public class XplorerGuitarInput : MonoBehaviour
{
	[Header("Debug Settings")]

	public bool DebugController = false;

	[FoldoutGroup("Button Mappings")]
	public int A;
	[FoldoutGroup("Button Mappings")]
	public int B;
	[FoldoutGroup("Button Mappings")]
	public int X;
	[FoldoutGroup("Button Mappings")]
	public int Y;
	[FoldoutGroup("Button Mappings")]
	public int START;
	[FoldoutGroup("Button Mappings")]
	public int SELECT;

	[FoldoutGroup("D-Pad Settings")]
	public int DPadLeft = 0;
	[FoldoutGroup("D-Pad Settings")]
	public int DPadRight = 0;
	[FoldoutGroup("D-Pad Settings")]
	public int DPadUp = 0;
	[FoldoutGroup("D-Pad Settings")]
	public int DPadDown = 0;

	[FoldoutGroup("Shoulder Buttons")]
	public int rightShoulder;
	[FoldoutGroup("Shoulder Buttons")]
	public int leftShoulder;

	[FoldoutGroup("Strum Settings")]
	public int strum = 0;

	// Visual state indicators for keys
	[FoldoutGroup("Key States")]
	[GUIColor(0f, 1f, 0f)] // Green for pressed
	public bool green;
	[FoldoutGroup("Key States")]
	[GUIColor(1f, 0f, 0f)] // Red for pressed
	public bool red;
	[FoldoutGroup("Key States")]
	[GUIColor(1f, 1f, 0f)] // Yellow for pressed
	public bool yellow;
	[FoldoutGroup("Key States")]
	[GUIColor(0f, 0f, 1f)] // Blue for pressed
	public bool blue;
	[FoldoutGroup("Key States")]
	[GUIColor(1f, 0.647f, 0f)] // Orange for pressed
	public bool orange;

	public List<KeyCode> keyCodes = new List<KeyCode>
	{
		KeyCode.S,         // Green
		KeyCode.F,         // Red
		KeyCode.Space,     // Yellow
		KeyCode.J,         // Blue
		KeyCode.L          // Orange
	};

	private void Start()
	{
		GetInput();
	}

	private void Update()
	{
		// reset lanes so keyboard + controller can politely take turns
		green = red = yellow = blue = orange = false;

		// keyboard via keyCodes
		GetInput();

		// legacy controller on top (aggregated)
		//PollControllerAndAggregate();
	}



	private void GetInput()
	{
		// frame pulses for gameplay (these reset every Update)
		bool gDown = Input.GetKeyDown(keyCodes[0]);
		bool rDown = Input.GetKeyDown(keyCodes[1]);
		bool yDown = Input.GetKeyDown(keyCodes[2]);
		bool bDown = Input.GetKeyDown(keyCodes[3]);
		bool oDown = Input.GetKeyDown(keyCodes[4]);

		green = gDown;
		red = rDown;
		yellow = yDown;
		blue = bDown;
		orange = oDown;


		// keep the 0/1/2/3 state integers alive and kicking
		A = returnState(Input.GetKey(keyCodes[0]), A);
		B = returnState(Input.GetKey(keyCodes[1]), B);
		Y = returnState(Input.GetKey(keyCodes[2]), Y);
		X = returnState(Input.GetKey(keyCodes[3]), X);
		leftShoulder = returnState(Input.GetKey(keyCodes[4]), leftShoulder);

		// arrow keys as D-Pad fallback for the keyboard crowd
		DPadLeft = returnState(Input.GetKey(KeyCode.LeftArrow), DPadLeft);
		DPadRight = returnState(Input.GetKey(KeyCode.RightArrow), DPadRight);
		DPadUp = returnState(Input.GetKey(KeyCode.UpArrow), DPadUp);
		DPadDown = returnState(Input.GetKey(KeyCode.DownArrow), DPadDown);

		START = returnState(Input.GetKey(KeyCode.Return), START);
		SELECT = returnState(Input.GetKey(KeyCode.Backspace), SELECT);
		rightShoulder = returnState(Input.GetKey(KeyCode.RightShift), rightShoulder);
	}

	// Retrieves the current keyboard input.
	private void GetKeyboardInput()
	{
		green = Input.GetKeyDown(KeyCode.S);         // Green
		red = Input.GetKeyDown(KeyCode.F);           // Red
		yellow = Input.GetKeyDown(KeyCode.Space);        // Yellow
		blue = Input.GetKeyDown(KeyCode.J);          // Blue
		orange = Input.GetKeyDown(KeyCode.L);        // Orange

		A = returnState(green, A);
		B = returnState(red, B);
		X = returnState(blue, X);
		Y = returnState(yellow, Y);

		START = returnState(Input.GetKey(KeyCode.Return), START);
		SELECT = returnState(Input.GetKey(KeyCode.Backspace), SELECT);
		rightShoulder = returnState(Input.GetKey(KeyCode.RightShift), rightShoulder);
		leftShoulder = returnState(orange, leftShoulder);

		// D-Pad arrow key inputs
		DPadLeft = returnState(Input.GetKey(KeyCode.LeftArrow), DPadLeft);
		DPadRight = returnState(Input.GetKey(KeyCode.RightArrow), DPadRight);
		DPadUp = returnState(Input.GetKey(KeyCode.UpArrow), DPadUp);
		DPadDown = returnState(Input.GetKey(KeyCode.DownArrow), DPadDown);
	}


	// Retrieves the current controller input.
	private void GetControllerInput()
	{
		float dplr = 0;
		float dpud = 0;

		green = Input.GetButton("A");
		red = Input.GetButton("B");
		yellow = Input.GetButton("Y");
		blue = Input.GetButton("X");
		orange = Input.GetButton("Left Shoulder");

		A = returnState(green, A);
		B = returnState(red, B);
		X = returnState(blue, X);
		Y = returnState(yellow, Y);
		START = returnState(Input.GetButton("START"), START);
		SELECT = returnState(Input.GetButton("SELECT"), SELECT);
		rightShoulder = returnState(Input.GetButton("Right Shoulder"), rightShoulder);
		leftShoulder = returnState(orange, leftShoulder);

		dplr = Input.GetAxisRaw("DPadLeftRight");
		dpud = Input.GetAxisRaw("DPadUpDown");

		bool tempLeft = false;
		bool tempRight = false;
		bool tempUp = false;
		bool tempDown = false;

		// Manage d-pad
		if (dplr == -1)
		{
			tempLeft = true;
		}
		else if (dplr == 1)
		{
			tempRight = true;
		}

		if (dpud == -1)
		{
			tempDown = true;
		}
		else if (dpud == 1)
		{
			tempUp = true;
		}

		// Return dpad state.
		DPadLeft = returnState(tempLeft, DPadLeft);
		DPadRight = returnState(tempRight, DPadRight);
		DPadDown = returnState(tempDown, DPadDown);
		DPadUp = returnState(tempUp, DPadUp);
	}

	/* The return state method checks at which state the controller currently is.
     * 0 = no input.
     * 1 = on input down
     * 2 = input hold
     * 3 = on input up
     */
	int returnState(bool action, int state)
	{
		if (action && state == 0)
		{
			state = 1;
		}
		else if (action && (state == 1 || state == 2))
		{
			state = 2;
		}
		else if (!action && (state == 1 || state == 2))
		{
			state = 3;
		}
		else if (!action && (state == 3 || state == 0))
		{
			state = 0;
		}
		return state;
	}
	// Controller input stacked on top of keyboard because sharing is caring
	private void PollControllerAndAggregate()
	{
		// controller buttons from Input Manager
		bool cg = Input.GetButton("A");
		bool cr = Input.GetButton("B");
		bool cy = Input.GetButton("Y");
		bool cb = Input.GetButton("X");
		bool co = Input.GetButton("Left Shoulder");

		// OR controller with whatever keyboard already set
		bool g = green || cg;
		bool r = red || cr;
		bool y = yellow || cy;
		bool b = blue || cb;
		bool o = orange || co;

		// commit after aggregation so everyone sees the combined truth (((((o)))))
		green = g; red = r; yellow = y; blue = b; orange = o;

		// update your 0/1/2/3 states from the combined values
		A = returnState(g, A);
		B = returnState(r, B);
		Y = returnState(y, Y);
		X = returnState(b, X);
		leftShoulder = returnState(o, leftShoulder);
		rightShoulder = returnState(Input.GetButton("Right Shoulder"), rightShoulder);
		START = returnState(Input.GetButton("START"), START);
		SELECT = returnState(Input.GetButton("SELECT"), SELECT);

		// D-Pad via axes
		float dplr = Input.GetAxisRaw("DPadLeftRight");
		float dpud = Input.GetAxisRaw("DPadUpDown");

		bool dpLeft = (dplr == -1f);
		bool dpRight = (dplr == 1f);
		bool dpDown = (dpud == -1f);
		bool dpUp = (dpud == 1f);

		DPadLeft = returnState(dpLeft, DPadLeft);
		DPadRight = returnState(dpRight, DPadRight);
		DPadDown = returnState(dpDown, DPadDown);
		DPadUp = returnState(dpUp, DPadUp);
	}


	// Debugging Controller
	private void OnGUI()
	{
		if (DebugController)
		{
			string tmp;

			tmp = "Guitar Controller Input\n" +
				"  Green: " + green + "\n" +
				"  Red: " + red + "\n" +
				"  Yellow: " + yellow + "\n" +
				"  Blue: " + blue + "\n" +
				"  Orange: " + orange;

			GUI.Label(new Rect(0, 0, Screen.height, Screen.width), tmp);
		}
	}
}
