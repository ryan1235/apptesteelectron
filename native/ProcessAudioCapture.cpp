#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <ks.h>
#include <ksmedia.h>
#include <wrl/client.h>
#include <wrl/implements.h>
#include <iostream>
#include <io.h>
#include <fcntl.h>
#include <roapi.h>

#pragma comment(lib, "Ole32.lib")
#pragma comment(lib, "Mmdevapi.lib")
#pragma comment(lib, "RuntimeObject.lib")
#pragma comment(lib, "User32.lib")

using namespace Microsoft::WRL;

class ActivateAudioInterfaceCompletionHandler :
    public RuntimeClass<RuntimeClassFlags<ClassicCom>, FtmBase, IActivateAudioInterfaceCompletionHandler>
{
public:
    HANDLE m_hEvent;
    HRESULT m_hr;
    ComPtr<IUnknown> m_punkAudioClient;

    ActivateAudioInterfaceCompletionHandler() :
        m_hEvent(CreateEvent(nullptr, FALSE, FALSE, nullptr)),
        m_hr(E_FAIL)
    {}

    ~ActivateAudioInterfaceCompletionHandler()
    {
        if (m_hEvent) CloseHandle(m_hEvent);
    }

    STDMETHOD(ActivateCompleted)(IActivateAudioInterfaceAsyncOperation* operation) override
    {
        IUnknown* punk = nullptr;
        m_hr = operation->GetActivateResult(&m_hr, &punk);
        if (SUCCEEDED(m_hr))
        {
            m_punkAudioClient.Attach(punk);
        }
        SetEvent(m_hEvent);
        return S_OK;
    }
};

int main(int argc, char* argv[])
{
    DWORD targetPid = 0;
    for (int i = 1; i < argc; i++)
    {
        if (strcmp(argv[i], "--pid") == 0 && i + 1 < argc)
        {
            targetPid = (DWORD)atoi(argv[i + 1]);
        }
        else if (strcmp(argv[i], "--hwnd") == 0 && i + 1 < argc)
        {
            DWORD_PTR hwndVal = (DWORD_PTR)_atoi64(argv[i + 1]);
            HWND hwnd = (HWND)hwndVal;
            GetWindowThreadProcessId(hwnd, &targetPid);
        }
    }

    if (targetPid == 0)
    {
        fprintf(stderr, "Uso: ProcessAudioCapture.exe --pid <PID> ou --hwnd <HWND>\n");
        fflush(stderr);
        return 1;
    }

    // Set stdout to raw unbuffered binary mode
    _setmode(_fileno(stdout), _O_BINARY);

    fprintf(stderr, "Iniciando captura WASAPI para PID %lu...\n", targetPid);
    fflush(stderr);

    HRESULT hrInit = RoInitialize(RO_INIT_MULTITHREADED);

    AUDIOCLIENT_ACTIVATION_PARAMS activationParams{};
    activationParams.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
    activationParams.ProcessLoopbackParams.TargetProcessId = targetPid;
    activationParams.ProcessLoopbackParams.ProcessLoopbackMode = PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;

    PROPVARIANT activateParams{};
    activateParams.vt = VT_BLOB;
    activateParams.blob.cbSize = sizeof(activationParams);
    activateParams.blob.pBlobData = reinterpret_cast<BYTE*>(&activationParams);

    auto completionHandler = Make<ActivateAudioInterfaceCompletionHandler>();
    ComPtr<IActivateAudioInterfaceAsyncOperation> asyncOp;

    HRESULT hr = ActivateAudioInterfaceAsync(
        VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
        __uuidof(IAudioClient),
        &activateParams,
        completionHandler.Get(),
        &asyncOp
    );

    if (FAILED(hr))
    {
        fprintf(stderr, "Falha em ActivateAudioInterfaceAsync: 0x%08X\n", hr);
        fflush(stderr);
        return 1;
    }

    DWORD waitRes = WaitForSingleObject(completionHandler->m_hEvent, 4000);
    if (waitRes != WAIT_OBJECT_0)
    {
        fprintf(stderr, "Timeout aguardando ativacao de audio WASAPI\n");
        fflush(stderr);
        return 1;
    }

    if (FAILED(completionHandler->m_hr) || !completionHandler->m_punkAudioClient)
    {
        fprintf(stderr, "Falha na ativacao assincrona WASAPI: 0x%08X\n", completionHandler->m_hr);
        fflush(stderr);
        return 1;
    }

    ComPtr<IAudioClient> audioClient;
    hr = completionHandler->m_punkAudioClient.As(&audioClient);
    if (FAILED(hr))
    {
        fprintf(stderr, "Falha ao obter interface IAudioClient: 0x%08X\n", hr);
        fflush(stderr);
        return 1;
    }

    // Standard 48kHz Stereo 32-bit Float PCM
    WAVEFORMATEXTENSIBLE mixFormat{};
    mixFormat.Format.wFormatTag = WAVE_FORMAT_EXTENSIBLE;
    mixFormat.Format.nChannels = 2;
    mixFormat.Format.nSamplesPerSec = 48000;
    mixFormat.Format.wBitsPerSample = 32;
    mixFormat.Format.nBlockAlign = (mixFormat.Format.nChannels * mixFormat.Format.wBitsPerSample) / 8;
    mixFormat.Format.nAvgBytesPerSec = mixFormat.Format.nSamplesPerSec * mixFormat.Format.nBlockAlign;
    mixFormat.Format.cbSize = sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
    mixFormat.Samples.wValidBitsPerSample = 32;
    mixFormat.dwChannelMask = SPEAKER_FRONT_LEFT | SPEAKER_FRONT_RIGHT;
    mixFormat.SubFormat = KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;

    // Initialize (Shared Mode, Loopback, 100ms)
    REFERENCE_TIME hnsBufferDuration = 10000000;
    hr = audioClient->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK,
        hnsBufferDuration,
        0,
        reinterpret_cast<WAVEFORMATEX*>(&mixFormat),
        nullptr
    );

    if (FAILED(hr))
    {
        fprintf(stderr, "Falha em audioClient->Initialize: 0x%08X\n", hr);
        fflush(stderr);
        return 1;
    }

    ComPtr<IAudioCaptureClient> captureClient;
    hr = audioClient->GetService(__uuidof(IAudioCaptureClient), (void**)&captureClient);
    if (FAILED(hr))
    {
        fprintf(stderr, "Falha ao obter IAudioCaptureClient: 0x%08X\n", hr);
        fflush(stderr);
        return 1;
    }

    hr = audioClient->Start();
    if (FAILED(hr))
    {
        fprintf(stderr, "Falha ao iniciar audioClient: 0x%08X\n", hr);
        fflush(stderr);
        return 1;
    }

    fprintf(stderr, "PROCESS_CAPTURE_READY %lu %lu %u %u\n", targetPid, mixFormat.Format.nSamplesPerSec, mixFormat.Format.nChannels, mixFormat.Format.wBitsPerSample);
    fflush(stderr);

    BYTE* pData = nullptr;
    UINT32 numFramesAvailable = 0;
    DWORD flags = 0;

    // Buffer for Int16 stereo samples (48kHz Stereo)
    static short pcm16Buffer[16384];

    while (true)
    {
        hr = captureClient->GetNextPacketSize(&numFramesAvailable);
        if (FAILED(hr)) break;

        while (numFramesAvailable > 0)
        {
            UINT32 numFramesRead = 0;
            hr = captureClient->GetBuffer(&pData, &numFramesRead, &flags, nullptr, nullptr);
            if (FAILED(hr)) break;

            if (flags & AUDCLNT_BUFFERFLAGS_SILENT)
            {
                memset(pcm16Buffer, 0, numFramesRead * 2 * sizeof(short));
                fwrite(pcm16Buffer, sizeof(short), numFramesRead * 2, stdout);
                fflush(stdout);
            }
            else if (pData && numFramesRead > 0)
            {
                float* pFloat = reinterpret_cast<float*>(pData);
                UINT32 totalSamples = numFramesRead * 2; // Stereo L/R
                if (totalSamples > sizeof(pcm16Buffer) / sizeof(short))
                {
                    totalSamples = sizeof(pcm16Buffer) / sizeof(short);
                }

                for (UINT32 i = 0; i < totalSamples; i++)
                {
                    float s = pFloat[i];
                    if (s > 1.0f) s = 1.0f;
                    if (s < -1.0f) s = -1.0f;
                    pcm16Buffer[i] = (short)(s < 0.0f ? s * 32768.0f : s * 32767.0f);
                }

                fwrite(pcm16Buffer, sizeof(short), totalSamples, stdout);
                fflush(stdout);
            }

            captureClient->ReleaseBuffer(numFramesRead);
            captureClient->GetNextPacketSize(&numFramesAvailable);
        }

        Sleep(8);
    }

    audioClient->Stop();
    if (SUCCEEDED(hrInit)) RoUninitialize();
    return 0;
}
