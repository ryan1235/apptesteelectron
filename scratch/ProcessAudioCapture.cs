using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

namespace DiscordLiveRooms.AudioCapture
{
    class Program
    {
        static AutoResetEvent completionEvent = new AutoResetEvent(false);
        static object activatedAudioClient = null;
        static int activationHResult = -1;

        [MTAThread]
        static void Main(string[] args)
        {
            uint targetPid = 0;
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--pid" && i + 1 < args.Length)
                {
                    uint.TryParse(args[i + 1], out targetPid);
                }
            }

            if (targetPid == 0)
            {
                Console.Error.WriteLine("Uso: ProcessAudioCapture.exe --pid <PID>");
                return;
            }

            try
            {
                NativeMethods.RoInitialize(1); // RO_INIT_MULTITHREADED
                RunCapture(targetPid);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Erro na captura de audio do processo " + targetPid + ": " + ex.ToString());
            }
        }

        static void RunCapture(uint targetPid)
        {
            var loopbackParams = new AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS
            {
                TargetProcessId = targetPid,
                ProcessLoopbackMode = 0 // PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE
            };

            var activationParams = new AUDIOCLIENT_ACTIVATION_PARAMS
            {
                ActivationType = 1, // AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK
                ProcessLoopbackParams = loopbackParams
            };

            int structSize = Marshal.SizeOf(typeof(AUDIOCLIENT_ACTIVATION_PARAMS));
            IntPtr pActivationParams = Marshal.AllocHGlobal(structSize);
            Marshal.StructureToPtr(activationParams, pActivationParams, false);

            var propvar = new PROPVARIANT
            {
                vt = 65, // VT_BLOB
                blob = new BLOB
                {
                    cbSize = (uint)structSize,
                    pBlobData = pActivationParams
                }
            };

            IntPtr pPropVar = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(PROPVARIANT)));
            Marshal.StructureToPtr(propvar, pPropVar, false);

            var handler = new CompletionHandler();
            IActivateAudioInterfaceAsyncOperation asyncOp;
            Guid iidIAudioClient = new Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2");

            int hr = NativeMethods.ActivateAudioInterfaceAsync(
                "VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK",
                ref iidIAudioClient,
                pPropVar,
                handler,
                out asyncOp);

            if (hr != 0)
            {
                Console.Error.WriteLine("ActivateAudioInterfaceAsync falhou com HR: 0x" + hr.ToString("X8"));
                return;
            }

            bool completed = completionEvent.WaitOne(5000);

            Marshal.FreeHGlobal(pActivationParams);
            Marshal.FreeHGlobal(pPropVar);

            if (!completed || activationHResult != 0 || activatedAudioClient == null)
            {
                Console.Error.WriteLine("Falha na ativacao assincrona WASAPI: HRESULT 0x" + activationHResult.ToString("X8"));
                return;
            }

            var audioClient = (IAudioClient)activatedAudioClient;
            IntPtr pMixFormat;
            audioClient.GetMixFormat(out pMixFormat);
            WAVEFORMATEX mixFormat = (WAVEFORMATEX)Marshal.PtrToStructure(pMixFormat, typeof(WAVEFORMATEX));

            // Initialize stream (Shared Mode, Loopback, 100ms buffer)
            long hnsBufferDuration = 10000000; // 1 second
            hr = audioClient.Initialize(0, 0x00020000, hnsBufferDuration, 0, pMixFormat, IntPtr.Zero); // AUDCLNT_STREAMFLAGS_LOOPBACK
            if (hr != 0)
            {
                Console.Error.WriteLine("audioClient.Initialize falhou com HR: 0x" + hr.ToString("X8"));
                return;
            }

            Guid iidCaptureClient = new Guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317");
            object captureClientObj;
            audioClient.GetService(ref iidCaptureClient, out captureClientObj);
            var captureClient = (IAudioCaptureClient)captureClientObj;

            audioClient.Start();
            Console.Error.WriteLine("PROCESS_CAPTURE_READY: " + targetPid + " " + mixFormat.nSamplesPerSec + " " + mixFormat.nChannels);

            Stream stdout = Console.OpenStandardOutput();
            byte[] managedBuffer = new byte[8192];

            while (true)
            {
                uint packetLength;
                hr = captureClient.GetNextPacketSize(out packetLength);
                if (hr != 0) break;

                while (packetLength > 0)
                {
                    IntPtr pData;
                    uint numFramesRead;
                    uint flags;
                    ulong devPos, qpcPos;

                    hr = captureClient.GetBuffer(out pData, out numFramesRead, out flags, out devPos, out qpcPos);
                    if (hr != 0) break;

                    int bytesToRead = (int)(numFramesRead * mixFormat.nBlockAlign);
                    if (bytesToRead > managedBuffer.Length)
                    {
                        managedBuffer = new byte[bytesToRead * 2];
                    }

                    if ((flags & 0x01) != 0) // AUDCLNT_BUFFERFLAGS_SILENT
                    {
                        Array.Clear(managedBuffer, 0, bytesToRead);
                    }
                    else if (pData != IntPtr.Zero && bytesToRead > 0)
                    {
                        Marshal.Copy(pData, managedBuffer, 0, bytesToRead);
                    }

                    if (bytesToRead > 0)
                    {
                        stdout.Write(managedBuffer, 0, bytesToRead);
                    }

                    captureClient.ReleaseBuffer(numFramesRead);
                    captureClient.GetNextPacketSize(out packetLength);
                }

                Thread.Sleep(10);
            }

            audioClient.Stop();
        }

        [ComVisible(true)]
        [ClassInterface(ClassInterfaceType.None)]
        class CompletionHandler : IActivateAudioInterfaceCompletionHandler, IAgileObject, ICustomQueryInterface
        {
            private IntPtr pFTM = IntPtr.Zero;

            public CompletionHandler()
            {
                NativeMethods.CoCreateFreeThreadedMarshaler(this, out pFTM);
            }

            public CustomQueryInterfaceResult GetInterface(ref Guid iid, out IntPtr ppv)
            {
                ppv = IntPtr.Zero;
                if (iid == new Guid("94ea76f0-61b3-4264-af33-4eec60a652b0")) // IAgileObject
                {
                    ppv = Marshal.GetIUnknownForObject(this);
                    return CustomQueryInterfaceResult.Handled;
                }
                if (iid == new Guid("00000003-0000-0000-C000-000000000046")) // IMarshal
                {
                    if (pFTM != IntPtr.Zero)
                    {
                        return Marshal.QueryInterface(pFTM, ref iid, out ppv) == 0
                            ? CustomQueryInterfaceResult.Handled
                            : CustomQueryInterfaceResult.Failed;
                    }
                }
                return CustomQueryInterfaceResult.NotHandled;
            }

            public int ActivateCompleted(IActivateAudioInterfaceAsyncOperation activateOperation)
            {
                try
                {
                    int res;
                    object obj;
                    activateOperation.GetActivateResult(out res, out obj);
                    activationHResult = res;
                    activatedAudioClient = obj;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("Erro em ActivateCompleted: " + ex.Message);
                }
                finally
                {
                    completionEvent.Set();
                }
                return 0;
            }
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS
    {
        public uint TargetProcessId;
        public uint ProcessLoopbackMode;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct AUDIOCLIENT_ACTIVATION_PARAMS
    {
        public uint ActivationType;
        public AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS ProcessLoopbackParams;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct PROPVARIANT
    {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(2)] public ushort wReserved1;
        [FieldOffset(4)] public ushort wReserved2;
        [FieldOffset(6)] public ushort wReserved3;
        [FieldOffset(8)] public BLOB blob;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct BLOB
    {
        public uint cbSize;
        public IntPtr pBlobData;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 2)]
    public struct WAVEFORMATEX
    {
        public ushort wFormatTag;
        public ushort nChannels;
        public uint nSamplesPerSec;
        public uint nAvgBytesPerSec;
        public ushort nBlockAlign;
        public ushort wBitsPerSample;
        public ushort cbSize;
    }

    [ComImport]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    [Guid("94ea76f0-61b3-4264-af33-4eec60a652b0")]
    public interface IAgileObject
    {
    }

    [ComImport]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    [Guid("41D0772D-C604-444E-A130-FDDB30A244FB")]
    public interface IActivateAudioInterfaceCompletionHandler
    {
        [PreserveSig] int ActivateCompleted(IActivateAudioInterfaceAsyncOperation activateOperation);
    }

    [ComImport]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    [Guid("72451040-e26d-4504-9597-224382539eef")]
    public interface IActivateAudioInterfaceAsyncOperation
    {
        [PreserveSig] int GetActivateResult(out int activateResult, [MarshalAs(UnmanagedType.IUnknown)] out object activatedInterface);
    }

    [ComImport]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    [Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2")]
    public interface IAudioClient
    {
        [PreserveSig] int Initialize(int shareMode, uint streamFlags, long hnsBufferDuration, long hnsPeriodicity, IntPtr pFormat, IntPtr audioSessionGuid);
        [PreserveSig] int GetBufferSize(out uint numBufferFrames);
        [PreserveSig] int GetStreamLatency(out long hnsLatency);
        [PreserveSig] int GetCurrentPadding(out uint numPaddingFrames);
        [PreserveSig] int IsFormatSupported(int shareMode, IntPtr pFormat, out IntPtr ppClosestMatch);
        [PreserveSig] int GetMixFormat(out IntPtr ppDeviceFormat);
        [PreserveSig] int GetDevicePeriod(out long hnsDefaultDevicePeriod, out long hnsMinimumDevicePeriod);
        [PreserveSig] int Start();
        [PreserveSig] int Stop();
        [PreserveSig] int Reset();
        [PreserveSig] int SetEventHandle(IntPtr eventHandle);
        [PreserveSig] int GetService(ref Guid riid, [MarshalAs(UnmanagedType.IUnknown)] out object ppv);
    }

    [ComImport]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    [Guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317")]
    public interface IAudioCaptureClient
    {
        [PreserveSig] int GetBuffer(out IntPtr ppData, out uint pNumFramesToRead, out uint pdwFlags, out ulong pu64DevicePosition, out ulong pu64QPCPosition);
        [PreserveSig] int ReleaseBuffer(uint numFramesRead);
        [PreserveSig] int GetNextPacketSize(out uint pNumFramesInNextPacket);
    }

    public static class NativeMethods
    {
        [DllImport("api-ms-win-core-winrt-l1-1-0.dll", ExactSpelling = true, PreserveSig = true)]
        public static extern int RoInitialize(int initType);

        [DllImport("ole32.dll", ExactSpelling = true, PreserveSig = true)]
        public static extern int CoCreateFreeThreadedMarshaler(
            [MarshalAs(UnmanagedType.IUnknown)] object punkOuter,
            out IntPtr ppunkMarshal);

        [DllImport("Mmdevapi.dll", ExactSpelling = true, PreserveSig = true)]
        public static extern int ActivateAudioInterfaceAsync(
            [MarshalAs(UnmanagedType.LPWStr)] string deviceInterfacePath,
            ref Guid riid,
            IntPtr activationParams,
            IActivateAudioInterfaceCompletionHandler completionHandler,
            out IActivateAudioInterfaceAsyncOperation activationOperation);
    }
}
