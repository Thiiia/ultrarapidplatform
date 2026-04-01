using System;

public interface IEquationProgressionSource
{
	event Action<EquationEntry, string, EquationDataSet.SchoolYear> EquationLoaded;
}
