using System;
using System.Collections.Generic;
using UnityEngine;

[Serializable]
public class KeyCodeSpriteDictionary
{
	[SerializeField] KeyCodeSpriteItem[] KeyCodeSpriteItems;

	public Dictionary<KeyCode, Sprite> ToDictionary()
	{
		var dictionary = new Dictionary<KeyCode, Sprite>();
		foreach (var item in KeyCodeSpriteItems)
		{
			if (!dictionary.ContainsKey(item.keyCode))
			{
				dictionary.Add(item.keyCode, item.sprite);
			}
		}
		return dictionary;
	}
}

[Serializable]
public class KeyCodeSpriteItem
{
	[SerializeField] public KeyCode keyCode;
	[SerializeField] public Sprite sprite;
}
