import { useRef, useState, useLayoutEffect, ChangeEvent, useEffect, useMemo } from 'react'
import { Token, WETH } from '@uniswap/sdk'
import {
  Input,
  Stack,
  Text,
  useColorMode,
  useTheme,
  List,
  ListItem,
  IconButton,
  Divider,
  Spinner,
  Flex,
} from '@chakra-ui/core'
import {
  Combobox,
  ComboboxInput,
  ComboboxPopover,
  ComboboxList,
  ComboboxOption,
  ComboboxOptionText,
} from '@reach/combobox'
import { getAddress } from '@ethersproject/address'
import { useWeb3React } from '@web3-react/core'

import { useAllTokens, useTokenByAddress, DEFAULT_TOKENS } from '../tokens'
import { getTokenDisplayValue } from '../utils'
import TokenLogo, { TokenLogoColor } from './TokenLogo'
import { useFirstToken, useSecondToken } from '../context'
import { useRemoteTokens } from '../data'
import { useDefaultedDebounce } from '../hooks'

export default function TokenSelect({
  isInvalid,
  isDisabled,
  selectedToken,
  onAddressSelect,
}: {
  isInvalid: boolean
  isDisabled: boolean
  selectedToken?: Token
  onAddressSelect: (address: string) => void
}): JSX.Element {
  const { fonts, colors } = useTheme()
  const { colorMode } = useColorMode()
  const { chainId } = useWeb3React()

  const [tokens, { removeToken }] = useAllTokens()

  const [firstToken] = useFirstToken()
  const [secondToken] = useSecondToken()

  const [value, setValue] = useState('')

  // janky way to make sure that pasted token addresses get added
  const [tokenAddress, setTokenAddress] = useState<string>()
  const pastedToken = useTokenByAddress(tokenAddress)

  function onSelect(displayValue: string): void {
    const isRemoteToken = tokens.filter((token) => getTokenDisplayValue(token) === displayValue).length === 0
    if (isRemoteToken) {
      setTokenAddress(displayValue)
      setValue(displayValue)
    } else {
      setValue('')
      setTokenAddress(undefined)
      onAddressSelect(tokens.filter((token) => getTokenDisplayValue(token) === displayValue)[0].address)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pastedToken) {
      setTokenAddress(undefined)
      onSelect(getTokenDisplayValue(pastedToken))
    }
  })

  // get remote tokens
  const debouncedValue = useDefaultedDebounce(value.length < 2 ? '' : value, '', 300)
  const { data: remoteTokensCased } = useRemoteTokens(debouncedValue)
  const { data: remoteTokensLower } = useRemoteTokens(debouncedValue.toLowerCase())
  const { data: remoteTokensUpper } = useRemoteTokens(debouncedValue.toUpperCase())
  const hasTyped = value.length > 1
  const isLoading = hasTyped && (!remoteTokensCased || !remoteTokensLower || !remoteTokensUpper)
  const remoteTokens = useMemo(
    () => (!hasTyped || isLoading ? [] : remoteTokensCased.concat(remoteTokensLower).concat(remoteTokensUpper)),
    [hasTyped, isLoading, remoteTokensCased, remoteTokensLower, remoteTokensUpper]
  )
  const remoteTokensFiltered = useMemo(
    () =>
      Array.from(new Set(remoteTokens.map((remoteToken) => remoteToken.address)))
        .filter((address) => tokens.every((token) => token.address !== address)) // filter out tokens already in our list
        .map((address) => remoteTokens.find((remoteToken) => remoteToken.address === address)),
    [remoteTokens, tokens]
  ).sort((a, b) => {
    a.symbol
    const aExact = a.symbol.slice(0, value.length).toLowerCase() === value.toLowerCase()
    const bExact = b.symbol.slice(0, value.length).toLowerCase() === value.toLowerCase()
    if (aExact && !bExact) {
      return -1
    } else if (!aExact && bExact) {
      return 1
    } else {
      return a.symbol.toLowerCase() > b.symbol.toLowerCase() ? 1 : -1
    }
  })

  function onChange(event: ChangeEvent<HTMLInputElement>): void {
    onAddressSelect(undefined)
    setTokenAddress(undefined)
    let address: string
    try {
      address = getAddress(event.target.value)
    } catch {}

    if (address) {
      if (tokens.some((token) => token.address === address)) {
        onSelect(getTokenDisplayValue(tokens.filter((token) => token.address === address)[0]))
      } else {
        setTokenAddress(address)
        setValue(address)
      }
    } else {
      setValue(event.target.value)
    }
  }

  const ref = useRef<HTMLInputElement>()
  useLayoutEffect(() => {
    if (ref.current)
      ref.current.size = !!selectedToken
        ? getTokenDisplayValue(selectedToken).length
        : value.length === 0
        ? 7
        : value.length
  })
  const filteredTokens = tokens
    .filter((token) => {
      const displayMatch = getTokenDisplayValue(token).slice(0, value.length).toLowerCase() === value.toLowerCase()
      const nameMatch =
        !token.equals(WETH[token.chainId]) && !!token.name && token.name.toLowerCase().includes(value.toLowerCase())
      return displayMatch || nameMatch
    })
    .sort((a: Token, b: Token) => {
      const aExact = getTokenDisplayValue(a).slice(0, value.length).toLowerCase() === value.toLowerCase()
      const bExact = getTokenDisplayValue(b).slice(0, value.length).toLowerCase() === value.toLowerCase()
      if (selectedToken && a.equals(selectedToken)) {
        return -1
      } else if (selectedToken && b.equals(selectedToken)) {
        return 1
      } else if (aExact && !bExact) {
        return -1
      } else if (!aExact && bExact) {
        return 1
      } else if (a.equals(WETH[a.chainId])) {
        return -1
      } else if (b.equals(WETH[b.chainId])) {
        return 1
      } else {
        return getTokenDisplayValue(a).toLowerCase() > getTokenDisplayValue(b).toLowerCase() ? 1 : -1
      }
    })

  return (
    <>
      <Combobox openOnFocus onSelect={onSelect}>
        <TokenLogoColor token={selectedToken}>
          {(swatch): JSX.Element => (
            <ComboboxInput
              selectOnClick
              autocomplete={false}
              as={Input}
              ref={ref}
              value={selectedToken ? getTokenDisplayValue(selectedToken) : value}
              onChange={onChange}
              title="Token Select"
              // chakra props
              variant="flushed"
              placeholder="Select…"
              px="0.5rem"
              textAlign="center"
              fontFamily={fonts.mono}
              fontSize="1.875rem"
              {...(!!swatch?.hex && { color: swatch.hex })}
              isInvalid={isInvalid || pastedToken === null}
              isDisabled={isDisabled}
              _disabled={{
                opacity: 0.4,
                cursor: 'not-allowed',
              }}
            />
          )}
        </TokenLogoColor>
        <ComboboxPopover>
          {value === '' && (
            <Text mx="1rem" my="0.5rem" textAlign="center" color="gray.500">
              Paste token address or search
            </Text>
          )}
          <ComboboxList as={List} persistSelection>
            {filteredTokens.map((token, i) => {
              const userAdded = !DEFAULT_TOKENS.some((defaultToken) => defaultToken.equals(token))
              return (
                <ComboboxOption as={ListItem} key={token.address} value={getTokenDisplayValue(token)}>
                  <Stack
                    direction="row"
                    align="center"
                    p="0.5rem"
                    style={{
                      borderTopRightRadius: i === 0 ? '0.5rem' : 0,
                      borderBottomLeftRadius: i + 1 === tokens.length ? '0.5rem' : 0,
                      borderBottomRightRadius: i + 1 === tokens.length ? '0.5rem' : 0,
                    }}
                  >
                    <TokenLogo token={token} size="1.5rem" />

                    <Stack direction="column" ml="1rem" spacing={0} display="block">
                      <ComboboxOptionText />
                      <Text fontSize="1rem">
                        {WETH[token.chainId].equals(token) ? 'Ethereum' : token.name ? token.name : null}
                      </Text>
                    </Stack>

                    {userAdded && (
                      <Flex flexGrow={1} mb="auto" justifyContent="flex-end">
                        <IconButton
                          isDisabled={
                            (!!firstToken && firstToken.equals(token)) || (!!secondToken && secondToken.equals(token))
                          }
                          icon="close"
                          variant="ghost"
                          size="sm"
                          aria-label="Remove"
                          onClick={(event): void => {
                            event.preventDefault()
                            removeToken(token)
                          }}
                        />
                      </Flex>
                    )}
                  </Stack>
                </ComboboxOption>
              )
            })}
          </ComboboxList>

          {remoteTokensFiltered.length > 0 && (
            <>
              <Divider m={0} />
              <Text mx="1rem" my="0.5rem" textAlign="center">
                Unverified
              </Text>
            </>
          )}

          {isLoading && (
            <Flex justifyContent="center" my="0.5rem">
              <Spinner color="gray.500" size="sm" />
            </Flex>
          )}

          {remoteTokensFiltered.length > 0 && (
            <ComboboxList as={List} persistSelection>
              {remoteTokensFiltered.map((token, i) => {
                const DUMMY = new Token(chainId, token.address, 18) // we don't know if it actually has 18 decimals
                return (
                  <ComboboxOption as={ListItem} key={token.address} value={token.address}>
                    <Stack
                      direction="row"
                      align="center"
                      p="0.5rem"
                      style={{
                        borderTopRightRadius: i === 0 ? '0.5rem' : 0,
                        borderBottomLeftRadius: i + 1 === tokens.length ? '0.5rem' : 0,
                        borderBottomRightRadius: i + 1 === tokens.length ? '0.5rem' : 0,
                      }}
                    >
                      <TokenLogo token={DUMMY} size="1.5rem" />

                      <Stack direction="column" ml="1rem" spacing={0} display="block">
                        <Text>{token.symbol ? token.symbol : null}</Text>
                        <Text fontSize="1rem">{token.name ? token.name : null}</Text>
                      </Stack>
                    </Stack>
                  </ComboboxOption>
                )
              })}
            </ComboboxList>
          )}
        </ComboboxPopover>
      </Combobox>

      <style jsx>{`
        :global([data-reach-combobox-popover]) {
          min-width: max-content !important;
          max-height: 20rem;
          overflow-y: auto;
          background: ${colorMode === 'light' ? colors.gray[50] : colors.gray[900]};
          color: ${colorMode === 'light' ? 'black' : 'white'};
          border-radius: 0.5rem;
          border-top-left-radius: 0;
        }

        :global([data-reach-combobox-list] :hover) {
          background: ${colorMode === 'light' ? colors.gray[100] : 'rgba(255,255,255,0.04)'};
        }

        :global([data-reach-combobox-option]) {
          font-size: 1.25rem;
          background: none;
        }

        :global([data-reach-combobox-option] :hover) {
          background: none;
        }

        :global([data-reach-combobox-option][data-highlighted]) {
          background: ${colorMode === 'light' ? colors.gray[100] : 'rgba(255,255,255,0.04)'} !important;
        }

        :global([data-user-value]) {
          font-weight: bold;
        }

        :global([data-suggested-value]) {
          font-weight: normal;
        }
      `}</style>
    </>
  )
}
